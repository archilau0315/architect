# 渲染工坊商业模式 - 当前模型配置

## 当前配置总览

### 商业模式模型选择逻辑

| 场景 | 尺寸 | 模式 | 当前模型 | 输入价格 | 输出价格 |
|------|------|------|---------|---------|---------|
| **局部修改** | 任意 | 任意 | gemini-3.1-flash-image-preview | 2.0 | 12.7 |
| **放大任务** | 4K | - | gemini-3-pro-image-preview | 17.0 | 102.3 |
| **放大任务** | 2K | - | gemini-3.1-flash-image-preview | 2.0 | 12.7 |
| **普通生成** | 4K | QUALITY | gemini-3-pro-image-preview | 17.0 | 102.3 |
| **普通生成** | 4K | FAST | gemini-3.1-flash-image-preview | 2.0 | 12.7 |
| **普通生成** | 2K | QUALITY | gemini-3.1-flash-image-preview | 2.0 | 12.7 |
| **普通生成** | 2K | FAST | gemini-3.1-flash-image-preview | 2.0 | 12.7 |
| **普通生成** | 1K | QUALITY | gemini-3.1-flash-image-preview | 2.0 | 12.7 |
| **普通生成** | 1K | FAST | gemini-3.1-flash-image-preview | 2.0 | 12.7 |

---

## 代码逻辑（第722-748行）

```typescript
if (useThirdPartyGateway) {
  // 商业模式矩阵 (ON)
  
  // 局部修改任务
  if (maskB && baseRefs.length > 0) {
    model = "gemini-3.1-flash-image-preview";
  }
  // 放大任务
  else if (isUpscale) {
    if (size === "4K") {
      model = "gemini-3-pro-image-preview";
    } else {
      model = "gemini-3.1-flash-image-preview";
    }
  }
  // 4K + QUALITY
  else if (size === "4K" && tier === "QUALITY") {
    model = "gemini-3-pro-image-preview";
  }
  // 其他所有情况
  else {
    model = "gemini-3.1-flash-image-preview";
  }
}
```

---

## 价格汇总

| 模型 | 输入价格 (CNY/M tokens) | 输出价格 (CNY/M tokens) |
|------|------------------------|------------------------|
| gemini-3.1-flash-image-preview | 2.0 | 12.7 |
| gemini-3-pro-image-preview | 17.0 | 102.3 |

---

## 当前配置特点

1. **1K 和 2K**：FAST 和 QUALITY 使用相同模型（gemini-3.1-flash-image-preview）
2. **4K**：QUALITY 用 Pro 模型，FAST 用 Flash 模型
3. **局部修改**：统一使用 Flash 模型
4. **放大任务**：4K 用 Pro，2K 用 Flash
