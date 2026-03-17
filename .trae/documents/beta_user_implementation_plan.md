# 内测阶段 Beta 用户方案

## 需求概述

进入内测阶段，设计 Beta 用户体系：
- 申请制，审核通过赠送 1000 积分
- 每日可用 200 积分，不累计，每日 0 点重置
- 可体验所有功能
- 下载限制：图片 1K+FAST，视频 SPEED，带水印
- 无水印下载按钮保留，点击时提示"内测期间暂不可用"
- 悬浮广告页展示内测政策

---

## 一、用户类型扩展

### 修改文件：`types.ts`

添加 `beta` 用户类型：

```typescript
export type UserTier = 'free' | 'beta' | 'basic' | 'pro' | 'plus';
```

---

## 二、积分配置扩展

### 修改文件：`App.tsx`

在 `TIER_CONFIG` 中添加 beta 配置：

```typescript
const TIER_CONFIG = {
  free: { daily: 100, label: '免费用户' },
  beta: { daily: 200, label: '内测用户', total: 1000 },  // 新增
  basic: { daily: 350, label: '基础级' },
  pro: { daily: 800, label: 'PRO 级' },
  plus: { daily: 1800, label: 'PLUS 级' }
};
```

---

## 三、Beta 用户积分逻辑

### 特殊逻辑：
1. Beta 用户有总积分上限（1000分）
2. 每日可用 200 分，用完当日不可再获得
3. 每日 0 点重置每日额度（不累计）
4. 总积分消耗完后，内测资格结束

### 修改文件：`App.tsx`

添加 Beta 积分追踪：

```typescript
// 新增状态
const [betaTotalPoints, setBetaTotalPoints] = useState(1000);  // Beta总积分
const [betaDailyUsed, setBetaDailyUsed] = useState(0);         // Beta当日已用
```

---

## 四、下载限制逻辑

### 图片下载限制（ImageGenerator.tsx）

Beta 用户：
- 尺寸只能选 1K
- 速度只能选 FAST
- 只能带水印下载
- 无水印按钮点击时弹出提示

### 视频下载限制（VideoGenerator.tsx）

Beta 用户：
- 只能选 SPEED 模式
- 只能带水印下载
- 无水印按钮点击时弹出提示

### 提示文案：
```
内测期间，无水印下载暂不可用
升级正式版即可解锁高清无水印下载
```

---

## 五、漂浮广告页组件

### 新建文件：`components/BetaPolicyBanner.tsx`

漂浮在应用界面上的内测政策公告：

**设计要点：**
- **漂浮效果**：使用 CSS 动画让卡片在界面上缓慢漂浮移动
- 随机初始位置，在屏幕范围内缓慢漂移
- 可通过右上角 X 关闭
- 关闭后存入 localStorage，下次不再显示
- 显示内测政策要点

**漂浮动画效果：**
```css
@keyframes float {
  0% { transform: translate(0, 0); }
  25% { transform: translate(20px, -15px); }
  50% { transform: translate(-10px, 20px); }
  75% { transform: translate(-20px, -10px); }
  100% { transform: translate(0, 0); }
}
```

**内容：**
```
🎯 内测用户专属权益

✅ 赠送 1000 积分体验金
✅ 每日 200 积分可用额度
✅ 全功能体验权限
⚠️ 下载仅支持标准画质+水印

内测期间无水印下载暂不可用
正式上线后解锁全部权益

[申请内测资格]
```

---

## 六、实现步骤

### 步骤 1：扩展类型定义
- 修改 `types.ts`，添加 `beta` 用户类型

### 步骤 2：更新积分配置
- 修改 `App.tsx`，添加 Beta 积分配置和逻辑

### 步骤 3：创建悬浮公告组件
- 新建 `BetaPolicyBanner.tsx`
- 显示内测政策
- 可关闭并记住状态

### 步骤 4：修改图片下载逻辑
- 修改 `ImageGenerator.tsx`
- Beta 用户限制尺寸和速度选择
- 无水印按钮点击提示

### 步骤 5：修改视频下载逻辑
- 修改 `VideoGenerator.tsx`
- Beta 用户限制模式选择
- 无水印按钮点击提示

### 步骤 6：集成悬浮公告
- 在 `App.tsx` 中引入 `BetaPolicyBanner`

---

## 七、UI 不变原则

- 所有现有 UI 布局不改动
- 无水印下载按钮保留原位置
- 只在点击时弹出提示，不执行下载
- 悬浮公告为独立组件，不影响现有布局

---

## 八、数据存储

Beta 用户状态存储在 localStorage：

```typescript
{
  "architect-user-tier": "beta",
  "architect-beta-info": {
    "totalPoints": 1000,
    "consumedPoints": 0,
    "dailyUsed": 0,
    "lastResetDate": "2026-03-17",
    "appliedAt": "2026-03-17",
    "approvedAt": "2026-03-17"
  },
  "architect-beta-banner-closed": false
}
```

---

## 九、后续扩展

内测结束后：
1. 将 Beta 用户转为 Free 用户
2. 或引导付费升级
3. 移除悬浮公告组件
