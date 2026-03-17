# 用户服务协议更新与注册流程说明

## 任务1：更新用户服务协议日期

**修改文件：** `legal/termsOfService.ts`

**修改内容：**
- 更新日期：2024年1月1日 → 2026年3月15日
- 生效日期：2024年1月1日 → 2026年3月15日

---

## 任务2：测试用户注册流程说明

### 当前实现方式

**用户等级存储位置：** `localStorage`

**关键代码位置：** `App.tsx`

```typescript
// 用户等级初始化
const savedTier = localStorage.getItem(USER_TIER_KEY) as UserTier || 'free';
setUserTier(savedTier);
```

### 用户等级切换方式

目前没有正式的注册/登录流程，用户等级通过以下方式设置：

#### 方式1：浏览器控制台手动设置
```javascript
// 设置为免费用户
localStorage.setItem('architect-user-tier', 'free');

// 设置为内测用户
localStorage.setItem('architect-user-tier', 'beta');

// 设置为基础用户
localStorage.setItem('architect-user-tier', 'basic');

// 设置为专业用户
localStorage.setItem('architect-user-tier', 'pro');

// 设置为尊享用户
localStorage.setItem('architect-user-tier', 'plus');

// 刷新页面生效
location.reload();
```

#### 方式2：设置面板（未实现）
目前设置面板中的"账户体系"页面只有 UI，没有实际的注册/登录功能。

### 后端 API（已准备）

后端已有以下 API，但前端尚未对接：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/beta/apply` | POST | 申请内测 |
| `/api/beta/status` | GET | 查询申请状态 |
| `/api/user/tier` | GET | 获取用户等级 |
| `/api/user/points` | GET | 获取积分余额 |

### 建议的完整注册流程

1. **用户访问欢迎页** → 点击"首席图像架构师"
2. **首次使用** → 弹出用户协议确认
3. **选择注册方式** → 邮箱/手机号
4. **后端验证** → 返回用户等级
5. **存储用户信息** → localStorage + 后端数据库

---

## 实施步骤

### 步骤1：更新协议日期
修改 `legal/termsOfService.ts` 中的日期

### 步骤2：说明注册流程
向用户解释当前的测试用户切换方式
