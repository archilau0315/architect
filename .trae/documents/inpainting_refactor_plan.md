# 局部修改功能完整逻辑分析与重构计划

## 一、当前局部修改逻辑梳理

### 1. 触发条件（第875行）

```typescript
else if (maskB && baseRefs.length > 0 && baseRefs[0].includes(",")) {
```

当满足以下条件时进入局部修改模式：
- `maskB` 存在（用户绘制了遮罩）
- `baseRefs` 有底图
- 底图是 base64 格式

---

### 2. 处理流程

| 步骤 | 代码位置 | 说明 |
|------|---------|------|
| 1. 获取原始尺寸 | 878-900行 | 加载底图获取宽高 |
| 2. 检测遮罩颜色 | 902-904行 | `detectMaskColors(maskB)` |
| 3. 合成图像 | 906-908行 | `overlayMaskOnBaseImage()` 将遮罩叠加到底图 |
| 4. 压缩图像 | 908行 | `compress(overlayedImage, true)` |
| 5. 构建提示词 | 927-934行 | 语义提示词 |
| 6. 添加到 parts | 936-937行 | 文本 + 合成图 |

---

### 3. 请求体构建（第1206-1226行）

```typescript
const requestBody: any = {
  model: modelId,                    // gemini-3-pro-image-preview
  prompt: enhancedPrompt,            // 语义提示词
  size: imageSize,                   // 1024x572（非标准尺寸）
  response_format: "b64_json",
  n: 1,
  seed: ...,
  temperature: dynamicTemperature,
  top_p: 0.95,
  output_mime_type: "image/png",
  reference_images: [                // 合成图
    { data: "...", mime_type: "image/jpeg" }
  ]
};
```

---

## 二、问题分析

### 问题1：ph8 API 可能不支持 reference_images

**分析**：
- ph8 的 `/images/generations` 端点可能不支持 `reference_images` 参数
- 或者需要不同的参数格式

### 问题2：非标准尺寸

**分析**：
- 当前尺寸是 `1024x572`（根据底图比例计算）
- ph8 可能只支持标准尺寸（如 1024x1024）

### 问题3：语义遮盖方式可能不被支持

**分析**：
- 当前使用"合成图 + 语义提示词"方式
- ph8 可能需要专门的 inpainting API

---

## 三、重构方案

### 方案A：使用标准尺寸

强制使用标准尺寸，不根据底图比例计算：

```typescript
// 局部修改强制使用 1024x1024
if (maskB && baseRefs.length > 0) {
  imageSize = "1024x1024";
}
```

### 方案B：检查 ph8 API 文档

需要确认：
1. ph8 是否支持 `reference_images` 参数
2. 局部修改是否需要使用不同的端点（如 `/images/edits`）
3. 是否需要使用 `mask` 参数而非语义遮盖

### 方案C：简化请求

尝试不发送 `reference_images`，仅发送文本提示词，看是否成功。

---

## 四、建议实施步骤

### 步骤1：添加详细日志

打印请求体大小和完整内容，确认问题。

### 步骤2：测试标准尺寸

将局部修改的尺寸强制改为 `1024x1024`。

### 步骤3：测试不带 reference_images

尝试不发送 `reference_images`，仅发送文本提示词。

### 步骤4：联系 ph8 确认 API 格式

如果以上都不行，需要确认 ph8 的正确 API 格式。

---

## 五、代码修改建议

### 修改1：强制使用标准尺寸

```typescript
// 在第1151行之后添加
if (maskB && baseRefs.length > 0) {
  imageSize = "1024x1024";  // 局部修改强制使用标准尺寸
  console.log("[局部修改] 强制使用标准尺寸: 1024x1024");
}
```

### 修改2：添加请求体大小日志

```typescript
const requestBodyStr = JSON.stringify(requestBody);
console.log(`[请求体大小] ${requestBodyStr.length} 字节 (${(requestBodyStr.length / 1024).toFixed(2)} KB)`);
```
