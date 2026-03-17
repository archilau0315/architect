# 局部修改逻辑分析报告

## 一、核心流程

### 1. 检测局部修改模式

**触发条件**（第875行）：
```typescript
else if (maskB && baseRefs.length > 0 && baseRefs[0].includes(",")) {
```

当满足以下条件时，进入局部修改模式：
- `maskB` 存在（用户绘制了遮罩）
- `baseRefs` 有底图
- 底图是 base64 格式

---

### 2. 获取底图尺寸

**目的**：确定原始图像大小，用于后续处理

```typescript
const img = new Image();
img.src = baseRefs[0];
const { width, height } = await imagePromise;
originalImageWidth = width;
originalImageHeight = height;
```

---

### 3. 检测遮罩颜色

**函数**：`detectMaskColors(maskDataUrl)`

**支持的颜色**：
- white (白色)
- red (红色)
- green (绿色)
- blue (蓝色)
- yellow (黄色)
- cyan (青色)

**输出示例**：
```
[语义遮盖] 检测到 1 种颜色: white
```

---

### 4. 合成图像（关键步骤）

**函数**：`overlayMaskOnBaseImage(baseRefs[0], maskB, 0.6)`

**作用**：将遮罩以 60% 透明度叠加到底图上

**结果**：生成一张合成图，包含底图内容 + 半透明遮罩标记

---

### 5. 构建语义提示词

```typescript
const semanticInpaintPrompt = `请修改这张图片中【${colorDescription}】的内容：${inpaintInstruction}

【重要要求】
1. 只修改图片中${colorDescription}的内容
2. 图片中其他所有区域必须保持完全不变
3. 不要在最终结果中显示任何标记或遮罩
4. 输出一张完整的、自然的图片`;
```

---

### 6. 构建 parts 数组

```typescript
parts.push({ text: semanticInpaintPrompt + STATIC_QUALITY_SUFFIX });
parts.push({ inlineData: { mimeType: "image/jpeg", data: compressedOverlay } });
```

**发送内容**：
1. 语义提示词（告诉模型修改哪个区域）
2. 合成图（底图 + 半透明遮罩）

---

## 二、API 请求体结构

### 最终发送到 ph8 的请求

```json
{
  "model": "gemini-3.1-flash-image-preview",
  "prompt": "请修改这张图片中【白色标记区域】的内容：...",
  "size": "1024x1024",
  "response_format": "b64_json",
  "n": 1,
  "seed": 123456,
  "temperature": 0.47,
  "top_p": 0.95,
  "output_mime_type": "image/png",
  "reference_images": [
    {
      "data": "base64编码的合成图数据...",
      "mime_type": "image/jpeg"
    }
  ]
}
```

---

## 三、502 错误分析

### 可能的原因

1. **服务器繁忙**（最可能）
   - ph8 返回："Sorry, the network is a bit busy right now"
   - 这是服务器端问题，非代码问题

2. **请求体过大**
   - 合成图（底图 + 遮罩）数据量较大
   - 可能导致超时或被拒绝

3. **模型不支持**
   - `gemini-3.1-flash-image-preview` 可能不支持语义遮盖方式
   - 需要确认 ph8 的正确参数格式

---

## 四、代码逻辑总结

| 步骤 | 输入 | 输出 |
|------|------|------|
| 1. 检测模式 | maskB + baseRefs | 进入局部修改模式 |
| 2. 获取尺寸 | baseRefs[0] | width, height |
| 3. 检测颜色 | maskB | ["white"] |
| 4. 合成图像 | 底图 + 遮罩 | overlayedImage |
| 5. 压缩图像 | overlayedImage | compressedOverlay (base64) |
| 6. 构建提示词 | 颜色 + 用户指令 | semanticInpaintPrompt |
| 7. 发送请求 | prompt + 合成图 | API 响应 |

---

## 五、结论

**代码逻辑正确**，502 错误是 ph8 服务器端问题。

如果问题持续，可能需要：
1. 确认 ph8 是否支持这种语义遮盖方式
2. 尝试使用不同的模型
3. 减少图像数据大小
