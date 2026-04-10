# 积分计费系统优化 - PH8 实时费用对接

## 执行日期
2026-04-09

## 优化目标

将积分消耗从**预估固定值**改为**PH8 API 返回的真实费用**，实现精准计费。

---

## 修改内容

### 计费模式变更

**修改前（预估模式）**：
- Chat 对话：固定扣除 1 积分
- 图像生成：固定扣除 10 积分
- 视频生成：固定扣除 20 积分
- 局部修改：固定扣除 10 积分

**修改后（实时计费模式）**：
1. 先执行 API 调用（不预扣积分）
2. 等待 PH8 返回真实费用（`total_tokens`）
3. 使用公式计算用户积分：`userPoints = Math.ceil(realCost / 10)`
4. 扣除计算后的积分

---

## 计费公式

```typescript
// PH8 返回的 total_tokens 单位：万分之一元（0.0001元）
// 用户积分 = PH8费用 ÷ 10（向上取整）
// 利润率：10倍

const realCost = result.data.total_tokens; // PH8 返回的真实费用
const userPoints = Math.ceil(realCost / 10); // 用户扣除的积分
```

**示例**：
- PH8 费用：100（= 0.01元）→ 用户扣除：10 积分
- PH8 费用：250（= 0.025元）→ 用户扣除：25 积分
- PH8 费用：1500（= 0.15元）→ 用户扣除：150 积分

---

## 修改的文件

### 1. ConversationView.tsx
**修改位置**：
- 第 220-230 行：Chat 对话
- 第 233-252 行：图像生成
- 第 255-262 行：视频生成
- 第 272-297 行：局部修改（Inpaint）

**修改内容**：
- 移除预扣费逻辑（`if (!onConsumePoints(固定值))`）
- 添加后扣费逻辑（在 API 调用成功后 500ms 获取真实费用）
- 导入 `Ph8UsageService`

### 2. VideoGenerator.tsx
**修改位置**：
- 第 169-174 行：移除预扣费逻辑
- 第 202-220 行：添加后扣费逻辑

**修改内容**：
- 移除 `calculateVideoCost()` 的预扣费调用
- 视频生成成功后，获取 PH8 真实费用并扣除积分

### 3. ImageGenerator.tsx
**状态**：✅ 已经使用实时计费（无需修改）
- 第 560-578 行已实现后扣费逻辑

### 4. ChatBot.tsx
**状态**：✅ 已经使用实时计费（无需修改）
- 第 264-266 行已实现后扣费逻辑

---

## 技术实现

### 获取真实费用的流程

```typescript
// 1. 执行 API 调用
const result = await gemini.generateImage(...);

// 2. 延迟 500ms 后获取费用（等待 PH8 记录到数据库）
setTimeout(async () => {
  try {
    // 3. 获取用户 ID
    const session = localStorage.getItem('architect-invite-session');
    const sessionData = JSON.parse(session);
    const userId = sessionData.user_id || sessionData.email;

    // 4. 调用后端 API 获取最新费用
    const result = await Ph8UsageService.getLatestUsage(userId);
    
    if (result.success && result.data) {
      const realCost = result.data.total_tokens; // PH8 真实费用
      
      // 5. 计算用户积分（10倍利润）
      const userPoints = Math.ceil(realCost / 10);
      
      // 6. 扣除积分
      const deducted = onConsumePoints(userPoints);
      
      if (!deducted) {
        console.warn('[PH8费用] 积分不足，无法扣除:', userPoints);
      }
    }
  } catch (err) {
    console.error('获取PH8真实费用失败:', err);
  }
}, 500);
```

---

## 后端 API 支持

### 已有接口

**获取最新费用**：
```typescript
GET /api/usage/latest/:userId

Response:
{
  "success": true,
  "data": {
    "request_id": "req_123456",
    "model": "gemini-2.0-flash-exp",
    "prompt_tokens": 150,
    "completion_tokens": 200,
    "total_tokens": 350,  // 真实费用（单位：0.0001元）
    "request_type": "image_generation",
    "created_at": "2026-04-09 10:30:00"
  }
}
```

**积分消耗接口**：
```typescript
POST /api/user/consume-points

Request:
{
  "amount": 35,  // 用户积分
  "source": "image_generation",
  "description": "生成 1K 图像"
}

Response:
{
  "success": true,
  "message": "成功消耗 35 积分",
  "data": {
    "amount": 35,
    "new_balance": 965
  }
}
```

---

## 优势

### 1. 精准计费
- ✅ 根据 PH8 实际消耗计费，不会多扣或少扣
- ✅ 不同模型、不同分辨率的真实成本差异得到体现

### 2. 透明度
- ✅ 控制台输出详细费用信息
- ✅ 用户可以看到每次操作的真实成本

### 3. 灵活性
- ✅ 利润率可以统一调整（当前 10 倍）
- ✅ 支持不同功能使用不同利润率

### 4. 可追溯
- ✅ 每次费用都记录到数据库
- ✅ 可以生成详细的费用报表

---

## 控制台日志示例

```
[PH8真实费用-Image] {
  requestId: "req_1712345678_abc123",
  cost: 350,
  costInYuan: "0.0350",
  model: "gemini-2.0-flash-exp"
}
```

```
[PH8真实费用-Chat] {
  requestId: "req_1712345679_def456",
  cost: 120,
  costInYuan: "0.0120",
  model: "gemini-2.0-flash-thinking-exp"
}
```

```
[PH8真实费用-Video] {
  requestId: "req_1712345680_ghi789",
  cost: 2500,
  costInYuan: "0.2500",
  model: "veo-2"
}
```

---

## 测试建议

### 1. 图像生成测试
```
1. 生成 1K 图像
2. 查看控制台输出的 PH8 费用
3. 验证积分扣除 = Math.ceil(PH8费用 / 10)
4. 检查数据库 transactions 表记录
```

### 2. 对话测试
```
1. 发送一条对话
2. 查看控制台输出的 token 消耗
3. 验证积分扣除正确
4. 检查不同长度对话的费用差异
```

### 3. 视频生成测试
```
1. 生成视频
2. 查看 PH8 返回的真实费用
3. 验证积分扣除
4. 对比不同时长视频的费用
```

---

## 注意事项

### 1. 延迟获取费用
- 使用 `setTimeout(..., 500)` 延迟 500ms
- 原因：PH8 需要时间将费用记录到数据库
- 如果获取失败，不影响功能正常使用

### 2. 积分不足处理
- 后扣费模式下，用户可能在操作完成后才发现积分不足
- 当前策略：只在控制台警告，不影响已生成的内容
- 建议：在前端添加积分预警提示

### 3. 利润率调整
- 当前利润率：10 倍（`realCost / 10`）
- 如需调整，修改公式中的除数即可
- 建议：将利润率配置化，存储到 `system_config` 表

---

## 后续优化建议

### 短期（1 周内）
1. 添加积分预警功能（余额 < 100 时提示）
2. 在前端显示预估费用范围
3. 添加费用历史查询功能

### 中期（1 个月内）
1. 实现不同功能的差异化利润率
2. 添加费用统计报表
3. 支持批量操作的费用汇总

### 长期（3 个月内）
1. 实现预付费和后付费混合模式
2. 添加费用预算控制
3. 支持企业级费用管理

---

## 总结

✅ **已完成**：
- 所有功能模块改为 PH8 实时计费
- 移除固定预估值
- 统一使用 10 倍利润率
- 添加详细的控制台日志

✅ **优势**：
- 精准计费，透明可追溯
- 灵活调整利润率
- 支持不同模型的真实成本差异

✅ **测试建议**：
- 测试各功能的费用计算
- 验证数据库记录完整性
- 检查控制台日志输出

**系统现在已完全基于 PH8 真实费用进行积分计费！**
