# 局部修改 502 错误深度分析报告

## 问题现象

- **每次**局部修改都会报 502 错误
- 其他功能（普通生成、放大）正常
- 错误信息："Sorry, the network is a bit busy right now"

## 代码流程对比

### 普通生成（带底图）

```typescript
// 第970-1027行：常规模式
parts.push({ text: prompt + STATIC_QUALITY_SUFFIX });
parts.push({ inlineData: { mimeType: "image/jpeg", data: compressedBaseImage } });
```

### 局部修改

```typescript
// 第875-940行：局部修改模式
const overlayedImage = await overlayMaskOnBaseImage(baseRefs[0], maskB, 0.6);
const compressedOverlay = await compress(overlayedImage, true);

const semanticInpaintPrompt = `请修改这张图片中【白色标记区域】的内容：...`;
parts.push({ text: semanticInpaintPrompt + STATIC_QUALITY_SUFFIX });
parts.push({ inlineData: { mimeType: "image/jpeg", data: compressedOverlay } });
```

## 关键差异

| 项目 | 普通生成 | 局部修改 |
|------|---------|---------|
| 图像内容 | 原始底图 | **合成图（底图+遮罩）** |
| 提示词 | 用户提示词 | **语义提示词** |
| 图像大小 | 512px | **1024px** |
| 质量 | 0.85 | **0.92** |

## 可能的问题

### 问题1：合成图数据量过大

**分析**：
- 合成图使用 1024px + 0.92 质量
- 数据量可能是普通底图的 4-8 倍
- 可能超过 ph8 的请求大小限制

### 问题2：模型不支持语义遮盖

**分析**：
- `gemini-3.1-flash-image-preview` 可能无法理解"白色标记区域"的语义
- ph8 的 API 可能需要特定的 inpainting 参数格式

### 问题3：ph8 API 格式问题

**分析**：
- ph8 的 `/images/generations` 端点可能不支持通过 `reference_images` 进行局部修改
- 可能需要使用 `/images/edits` 或其他端点

## 建议排查步骤

### 步骤1：测试普通生成（带底图）

上传一张底图，进行普通生成，看是否成功。

**如果成功**：说明 `reference_images` 参数正常，问题在于合成图或语义提示词。

**如果失败**：说明 ph8 不支持 `reference_images` 参数。

### 步骤2：降低合成图大小

将局部修改的图像大小从 1024px 降到 512px：
```typescript
const maxSize = forInpainting ? 512 : 512;  // 统一使用 512px
```

### 步骤3：尝试不同的模型

将局部修改的模型改为 `gemini-3-pro-image-preview`：
```typescript
if (maskB && baseRefs.length > 0) {
  model = "gemini-3-pro-image-preview";  // 改用 Pro 模型
}
```

### 步骤4：添加请求体大小日志

```typescript
const requestBodyStr = JSON.stringify(requestBody);
console.log(`[请求体大小] ${requestBodyStr.length} 字节 (${(requestBodyStr.length / 1024).toFixed(2)} KB)`);
```

## 推荐解决方案

### 方案1：降低图像大小（优先尝试）

修改 `compress` 函数，降低局部修改的图像大小：
```typescript
const maxSize = forInpainting ? 512 : 512;  // 统一使用 512px
const quality = forInpainting ? 0.85 : 0.85;  // 统一使用 0.85
```

### 方案2：使用 Pro 模型

将局部修改的模型改为 `gemini-3-pro-image-preview`。

### 方案3：添加详细日志

添加请求体大小日志，确认是否是数据量问题。
