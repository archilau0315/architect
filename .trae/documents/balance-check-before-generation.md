# 生成前余额预检方案

## 需求
用户生成内容前，先查余额，如果余额大于模型生成一次的消耗，允许生成；否则提示"余额可能不足，请充值"。

## 当前状态分析

### 已有机制
1. **后端余额预检**（[ph8.js#L985-L1041](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/ph8.js#L985-L1041)）：
   - 通配符路由 `/*` 中已有预检逻辑
   - 但只检查 `totalAvailable <= 0`（余额是否为 0）
   - **不检查余额是否够支付本次请求**

2. **图片生成专用路由**（[ph8.js#L514](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/ph8.js#L514)）：
   - **完全没有余额预检**

3. **后端定价表**（[ph8.js#L36-L75](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/ph8.js#L36-L75)）：
   - `PH8_MODEL_PRICING` 包含所有模型的 input/output 价格

4. **前端余额获取**（[App.tsx#L217-L287](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/App.tsx#L217-L287)）：
   - 每 30 秒从 `/api/user/quota` 获取余额
   - 但 `consumePoints` 函数**没有被各组件实际调用**

### 问题
- 余额为 1 积分的用户可以发起需要 50 积分的视频生成请求
- 请求转发到 WellAI 后，后端 `deductBalance` 扣费失败（余额不足返回 false），但请求已经发出
- 用户看到生成失败，但不知道是余额不足导致的

## 实现方案

### 方案：后端预检增强（最小修改，不涉及前端）

在现有预检逻辑中增加**预估费用检查**，余额不足时直接拦截，不转发请求到 WellAI。

### 修改文件
**仅修改 1 个文件**：`backend/routes/ph8.js`

### 具体改动

#### 改动 1：新增 `estimateCost` 函数（在 `calculateCostFromTokens` 附近）

```javascript
/**
 * 根据模型和请求类型预估单次生成的最低消耗（积分）
 * @param {string} model - 模型名称
 * @param {string} requestType - 请求类型 (image/video/chat/unknown)
 * @returns {{estimatedPoints: number, estimatedCost: number, source: string}}
 */
function estimateCost(model, requestType) {
  // 查找定价
  let pricing = PH8_MODEL_PRICING[model];
  if (!pricing) {
    for (const [key, value] of Object.entries(PH8_MODEL_PRICING)) {
      if (model.startsWith(key.split('@')[0]) || key.includes(model) || model.includes(key.replace(/@.*$/, ''))) {
        pricing = value;
        break;
      }
    }
  }
  if (!pricing) {
    return { estimatedPoints: 0, estimatedCost: 0, source: 'no-pricing' };
  }

  let estimatedCost = 0;
  let source = '';

  if (requestType === 'image') {
    // 图片生成：预估 output ~5000 tokens
    estimatedCost = (5000 * pricing.outputPrice) / 1000000;
    source = `image-estimate:${model}`;
  } else if (requestType === 'video') {
    // 视频生成：预估 output ~50000 tokens（与 POST 计费逻辑一致）
    estimatedCost = (50000 * pricing.outputPrice) / 1000000;
    source = `video-estimate:${model}`;
  } else {
    // 聊天/分析：预估 input ~1000 + output ~2000 tokens
    estimatedCost = ((1000 * pricing.inputPrice) + (2000 * pricing.outputPrice)) / 1000000;
    source = `chat-estimate:${model}`;
  }

  const estimatedPoints = Math.max(1, Math.round(estimatedCost * 1000));
  return { estimatedPoints, estimatedCost: Math.round(estimatedCost * 100000) / 100000, source };
}
```

#### 改动 2：增强通配符路由预检逻辑（L1015-L1035）

将现有的 `totalAvailable <= 0` 检查替换为 `totalAvailable < estimatedPoints`：

```javascript
// 预估费用检查
const { estimatedPoints, estimatedCost, source } = estimateCost(model, requestType);

if (totalAvailable <= 0) {
  // 原有：余额为 0
  return res.status(429).json({
    error: '配额不足',
    message: '今日积分已用完，请明天再来或充值积分',
    code: 'QUOTA_EXCEEDED',
    data: { dailyUsed: du, dailyQuota: dq, dailyRemaining, totalPoints: tp }
  });
}

if (estimatedPoints > 0 && totalAvailable < estimatedPoints) {
  // 新增：余额不足以支付本次请求
  ph8Log.warn('余额不足-预检拦截', {
    userId: numericUserId,
    model,
    requestType,
    estimatedPoints,
    estimatedCost,
    totalAvailable,
    source
  });
  return res.status(429).json({
    error: '余额不足',
    message: `余额可能不足，本次操作预估需要 ${estimatedPoints} 积分，当前剩余 ${totalAvailable} 积分，请充值`,
    code: 'INSUFFICIENT_BALANCE',
    data: {
      estimatedPoints,
      estimatedCost,
      totalAvailable,
      dailyRemaining,
      totalPoints: tp,
      model,
      source
    }
  });
}
```

#### 改动 3：图片生成专用路由增加预检（L514 附近）

在 `router.post('/images/generations', requireAuth, async (req, res) => {` 内部，转发请求前添加余额预检逻辑：

```javascript
// 余额预检
const userResult = await getUserId(req);
const userId = userResult.userId;
const model = getModel(req.body, '/v1/images/generations');

if (userId && userId !== 'anonymous') {
  try {
    const numericUserId = typeof userId === 'number' ? userId : parseInt(userId);
    if (!isNaN(numericUserId) && numericUserId > 0) {
      const [quotaCheck] = await db.query(
        `SELECT daily_quota, daily_used, total_points, daily_reset_at, user_tier FROM kbit_users WHERE id = ?`,
        [numericUserId]
      );
      if (quotaCheck.length > 0) {
        let dq = parseFloat(quotaCheck[0].daily_quota) || 200;
        let du = parseFloat(quotaCheck[0].daily_used) || 0;
        let tp = parseFloat(quotaCheck[0].total_points) || 0;
        const tier = quotaCheck[0].user_tier || 'free';
        const dailyResetAt = quotaCheck[0].daily_reset_at;

        const today = new Date().toISOString().split('T')[0];
        if (dailyResetAt !== today || dailyResetAt === null) du = 0;

        const { getDailyPoints } = require('../config/tierConfig');
        const configQuota = getDailyPoints(tier);
        if (configQuota > dq) dq = configQuota;

        const dailyRemaining = Math.max(0, dq - du);
        const totalAvailable = tp + dailyRemaining;

        const { estimatedPoints } = estimateCost(model, 'image');

        if (totalAvailable < estimatedPoints) {
          return res.status(429).json({
            error: '余额不足',
            message: `余额可能不足，本次操作预估需要 ${estimatedPoints} 积分，当前剩余 ${totalAvailable} 积分，请充值`,
            code: 'INSUFFICIENT_BALANCE',
            data: { estimatedPoints, totalAvailable, model }
          });
        }
      }
    }
  } catch (e) {
    ph8Log.error('图片生成预检失败', { error: e.message });
  }
}
```

## 预估费用参考

| 模型 | 类型 | 预估费用（元） | 预估积分 |
|------|------|--------------|---------|
| gemini-3.1-flash-image-preview | 图片 | 0.053 | 53 |
| gemini-3-pro-image-preview | 图片 | 0.427 | 427 |
| doubao-seedance-1-0-pro-fast | 视频 | 0.21 | 210 |
| doubao-seedance-2-0 | 视频 | 2.3 | 2300 |
| gemini-3.1-flash-lite | 聊天 | 0.023 | 23 |
| deepseek-v3.2 | 聊天 | 0.005 | 5 |

## 前端适配

前端在 [geminiService.ts#L2118](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/services/geminiService.ts#L2118) 附近的错误处理中，已有 429 状态码处理逻辑，会显示后端返回的 `message` 字段。无需额外修改。

## 验证步骤
1. 修改后本地语法检查：`node -c backend/routes/ph8.js`
2. 上传到服务器：`/www/wwwroot/api.kbitai.com.cn/routes/ph8.js`
3. 重启后端：`pm2 restart kbitai-api`
4. 测试：用余额为 0 的用户尝试生成图片，应看到"余额可能不足"提示
5. 测试：用余额充足的用户尝试生成图片，应正常生成
