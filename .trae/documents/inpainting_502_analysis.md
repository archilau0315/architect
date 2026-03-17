# 局部修改 502 错误分析报告

## 问题现象

用户反馈：局部修改功能总是返回 502 错误

## 代码分析

### 1. 局部修改的判断逻辑

**第780-783行**：
```typescript
if (maskB && baseRefs.length > 0) {
  model = "gemini-3.1-flash-image-preview";
  console.log("[Inpainting] 使用 Flash 模型进行语义遮盖局部修改");
}
```

### 2. 局部修改的请求体构建

**第1206-1226行**：
```typescript
const requestBody: any = {
  model: modelId,
  prompt: enhancedPrompt,
  size: imageSize,
  response_format: "b64_json",
  n: 1,
  seed: Math.floor(Math.random() * 2147483647),
  temperature: dynamicTemperature,
  top_p: 0.95,
  output_mime_type: "image/png"
};

if (imageParts.length > 0) {
  requestBody.reference_images = imageParts.map((img: any) => ({
    data: img.inlineData.data,
    mime_type: img.inlineData.mimeType
  }));
}
```

## 可能的问题

### 问题1：局部修改缺少遮罩传递

**分析**：
- 代码检测到 `maskB` 存在时，会设置模型为 `gemini-3.1-flash-image-preview`
- **但是**：遮罩数据 `maskB` 并没有被传递到请求体中！
- API 只收到了底图和提示词，没有收到遮罩信息

**影响**：
- API 可能无法理解这是一个局部修改请求
- 或者 API 期望特定的参数格式来处理遮罩

### 问题2：模型不支持局部修改

**分析**：
- `gemini-3.1-flash-image-preview` 是图像生成模型
- 可能不支持通过 `reference_images` 进行局部修改
- ph8 的 API 可能需要不同的参数格式

### 问题3：请求体过大

**分析**：
- 局部修改需要传递底图 + 遮罩，数据量较大
- 可能导致请求超时或被网关拒绝

## 建议修改

### 方案1：添加遮罩参数传递

需要确认 ph8 API 是否支持以下格式：

```typescript
const requestBody: any = {
  model: modelId,
  prompt: enhancedPrompt,
  // ... 其他参数
};

if (maskB && baseRefs.length > 0) {
  // 底图
  requestBody.reference_images = [{
    data: baseImageData,
    mime_type: "image/jpeg"
  }];
  // 遮罩
  requestBody.mask = {
    data: maskBData,
    mime_type: "image/png"
  };
}
```

### 方案2：检查 ph8 API 文档

需要确认：
1. ph8 是否支持局部修改功能
2. 局部修改的正确参数格式
3. 是否需要使用不同的端点

## 下一步

需要用户提供：
1. ph8 API 的局部修改文档或示例
2. 或者确认 ph8 是否支持局部修改功能
