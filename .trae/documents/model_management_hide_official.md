# 设置面板模型管理修改计划

## 需求

在设置面板的"模型管理"中：
- 隐藏前三个默认模型（KbitAi-Pro、KbitAi-Flash、KbitAi-Image）
- 只保留用户新增的模型
- 保留新增模型功能

---

## 当前代码分析

### 1. 默认模型定义（App.tsx 第57-60行）

```typescript
const DEFAULT_MODELS: CustomModel[] = Object.freeze([
  { id: 'KbitAi-Pro', name: 'KbitAi-Pro-Core', modelId: 'KbitAi-Pro', isOfficial: true },
  { id: 'KbitAi-Flash', name: 'KbitAi-Flash-Speed', modelId: 'KbitAi-Flash', isOfficial: true },
  { id: 'KbitAi-Image', name: 'KbitAi-Image-Engine', modelId: 'KbitAi-Image', isOfficial: true }
]);
```

### 2. 模型列表渲染（SettingsPanel.tsx 第502行）

```typescript
{models.map((m, i) => (
  <div key={m.id} ...>
    // 模型卡片内容
  </div>
))}
```

---

## 修改方案

### 方案：过滤掉 isOfficial 为 true 的模型

在 SettingsPanel.tsx 中，修改模型列表渲染逻辑，只显示非官方模型：

```typescript
// 修改前
{models.map((m, i) => (

// 修改后
{models.filter(m => !m.isOfficial).map((m, i) => (
```

---

## 修改位置

**文件**：`components/SettingsPanel.tsx`
**行号**：第502行

---

## 注意事项

1. 保留新增模型功能（已有代码支持）
2. 默认模型仍然存在于数据中，只是不在界面显示
3. 用户无法删除默认模型（已有 `!m.isOfficial` 判断）
