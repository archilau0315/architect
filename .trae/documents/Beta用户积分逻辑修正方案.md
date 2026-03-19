# Beta 用户积分逻辑分析与修正方案

## 当前逻辑分析

### 导航栏余额计算
```javascript
balance = dailyPoints + purchasedPoints
```

### Beta 用户初始化
```javascript
purchasedPoints = 1000  // 注册赠送
dailyPoints = 200       // 每日积分
balance = 200 + 1000 = 1200
```

---

## 问题分析

### 当前逻辑的含义
- **注册赠送**：1000 积分（永久）
- **每日积分**：200 积分（每日重置）
- **总余额**：两者相加 = 1200

### 政策理解问题

根据用户反馈，**Beta 用户的正确政策应该是**：

| 项目 | 数值 | 说明 |
|------|------|------|
| 注册赠送 | 1000 积分 | 一次性体验金 |
| 每日可用 | 200 积分 | 每日消耗限额，**不是额外赠送** |

**正确理解**：每日 200 积分是**消耗限额**，不是额外获得的积分！

---

## 修正方案

### Beta 用户积分逻辑

| 项目 | 值 | 说明 |
|------|-----|------|
| 总积分 | 1000 | 注册赠送 |
| 总余额 | 1000 | 可用总额 |
| 日积分 | 200 | 每日消耗限额 |
| 日余额 | min(200, 总余额) | 今日可用 |

### 导航栏显示
- **余额**：应显示 `purchasedPoints`（1000），而不是 `dailyPoints + purchasedPoints`

### 消耗逻辑
- 每日最多消耗 200 积分
- 从总余额（1000）中扣除
- 总余额用完则无法继续使用

---

## 实施步骤

### 步骤 1：修改导航栏余额显示
```javascript
// 修改前
balance={dailyPoints + purchasedPoints}

// 修改后（Beta 用户只显示总余额）
balance={userTier === 'beta' ? purchasedPoints : dailyPoints + purchasedPoints}
```

### 步骤 2：修改 Beta 用户积分显示
- 总积分：1000（注册赠送）
- 总余额：purchasedPoints（可用总额）
- 日积分：200（每日限额）
- 日余额：min(200, purchasedPoints)（今日可用）

### 步骤 3：修改消耗逻辑
- Beta 用户每日最多消耗 200 积分
- 从 purchasedPoints 中扣除

---

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `App.tsx` | 修改 balance 计算逻辑 |
| `SettingsPanel.tsx` | 修改 Beta 用户积分显示 |

---

请确认后开始实施。
