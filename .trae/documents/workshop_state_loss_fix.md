# 工坊状态丢失问题分析与修复计划

## 问题分析

### 1. 当前实现

代码已经添加了 localStorage 持久化：
- **保存**：第143行 - `localStorage.setItem(WORKSHOP_STATE_KEY, ...)`
- **加载**：第116行 - `localStorage.getItem(WORKSHOP_STATE_KEY)`

### 2. 问题根源

**组件卸载导致状态丢失**：

在 `App.tsx` 中，`ImageGenerator` 组件使用了条件渲染：
```tsx
{activeTab === 'architect' && (
  <ImageGenerator key={architectKey} ... />
)}
```

当切换到 Chat Tab 时：
1. `activeTab` 变为 `'chat'`
2. `ImageGenerator` 组件被**完全卸载**
3. 组件内部状态全部丢失
4. 虽然有 localStorage 保存，但可能有以下问题：

### 3. 可能的问题

**问题 A：保存时机**
- useEffect 保存是在状态变化时触发
- 但组件卸载时，最后一次状态可能没有保存

**问题 B：加载时机**
- 组件重新挂载时，useState 初始值是空数组
- useEffect 加载在组件挂载后执行
- 可能存在时序问题

**问题 C：base64 数据过大**
- 图片 base64 数据可能超过 localStorage 限制（5MB）
- 导致保存失败

---

## 解决方案

### 方案：使用隐藏而非卸载

修改 `App.tsx`，使用 `display: none` 隐藏组件，而不是条件渲染卸载：

```tsx
// 修改前
{activeTab === 'architect' && (
  <ImageGenerator ... />
)}

// 修改后
<div style={{ display: activeTab === 'architect' ? 'block' : 'none' }}>
  <ImageGenerator ... />
</div>
```

这样组件不会被卸载，状态自然保留。

---

## 实施步骤

### 步骤1：修改 App.tsx

将条件渲染改为隐藏/显示方式：

**修改位置**：App.tsx 第409-445行

### 步骤2：移除 localStorage 持久化代码（可选）

如果使用隐藏方式，localStorage 持久化可以保留作为备份，也可以移除。

---

## 预期效果

- 切换 Tab 时组件不会被卸载
- 状态自然保留
- 无需依赖 localStorage
