# 内测功能下一步规划

## 当前实现状态

### ✅ 已完成（前端）
1. Beta 用户类型定义（`types.ts`）
2. 漂浮广告页组件（`BetaPolicyBanner.tsx`）
3. 下载限制逻辑（图片/视频）
4. 积分配置（每日 200，总计 1000）
5. 广告页关闭状态记忆

### ⚠️ 当前问题
1. **测试代码未清理** - App.tsx 中强制设置为 beta 用户
2. **纯前端实现** - 用户可修改 localStorage 绕过限制
3. **无后端管理** - 无法真正控制用户权限
4. **申请按钮无效** - 点击"申请内测资格"无实际功能

---

## 下一步工作

### 第一步：清理测试代码（立即执行）

修改 `App.tsx`，恢复正常逻辑：

```typescript
// 移除强制测试代码
const savedTier = localStorage.getItem(USER_TIER_KEY) as UserTier || 'free';
setUserTier(savedTier);

// 恢复正常的 Banner 显示逻辑
const betaBannerClosed = localStorage.getItem('architect-beta-banner-closed');
if (savedTier === 'beta' && betaBannerClosed !== 'true') {
  setShowBetaBanner(true);
}
```

---

### 第二步：后端管理方案（需要后端支持）

#### 方案 A：简单方案（推荐起步）

使用 **Supabase / Firebase** 等BaaS服务：

**数据表设计：**
```
beta_users:
  - id: uuid
  - email: string
  - phone: string (可选)
  - status: 'pending' | 'approved' | 'rejected' | 'expired'
  - total_points: number (1000)
  - consumed_points: number
  - daily_quota: number (200)
  - daily_used: number
  - last_reset_date: date
  - applied_at: timestamp
  - approved_at: timestamp
  - expires_at: timestamp
```

**API 接口：**
1. `POST /api/beta/apply` - 申请内测
2. `GET /api/beta/status` - 查询申请状态
3. `GET /api/beta/points` - 获取积分余额
4. `POST /api/beta/consume` - 消耗积分

#### 方案 B：自建后端

使用 Node.js + Express + PostgreSQL/MySQL

---

### 第三步：前端对接后端

**修改点：**

1. **申请按钮功能**
```typescript
// BetaPolicyBanner.tsx
const handleApply = async () => {
  const email = prompt('请输入您的邮箱申请内测资格：');
  if (!email) return;
  
  const res = await fetch('/api/beta/apply', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  
  if (res.ok) {
    alert('申请已提交，请等待审核！');
  }
};
```

2. **用户等级从后端获取**
```typescript
// App.tsx
useEffect(() => {
  fetch('/api/user/tier')
    .then(res => res.json())
    .then(data => setUserTier(data.tier));
}, []);
```

3. **积分消耗走后端**
```typescript
// 每次生成/下载前调用后端扣减积分
const consumePoints = async (amount: number) => {
  const res = await fetch('/api/beta/consume', {
    method: 'POST',
    body: JSON.stringify({ amount })
  });
  return res.ok;
};
```

---

### 第四步：管理后台（可选）

简单的管理界面功能：
1. 查看申请列表
2. 审批/拒绝申请
3. 查看用户积分使用情况
4. 手动调整积分

---

## 建议执行顺序

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 🔴 高 | 清理测试代码 | 恢复正式版配置 |
| 🟡 中 | 选择后端方案 | Supabase 最简单 |
| 🟡 中 | 实现申请接口 | 让按钮可用 |
| 🟢 低 | 管理后台 | 后续扩展 |

---

## 简化方案（无后端）

如果暂时不想搭建后端，可以：

1. **使用 Google Form / 腾讯问卷** 收集申请
2. **手动发放邀请码** 
3. **邀请码激活后写入 localStorage**

这种方式适合小规模内测（几十人）。

---

## 需要确认的问题

1. 是否有现成的后端服务？
2. 预计内测用户规模？
3. 是否需要管理后台？
4. 申请审核流程是自动还是人工？
