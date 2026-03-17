# 大模型接口调用协议文档

## 一、当前系统支持的 API 协议

### 1. Gemini 原生协议 (Google 官方)

**适用场景**：开发模式、Google Cloud 官方节点

**端点格式**：
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

**请求格式**：
```typescript
{
  model: "gemini-3-flash-preview",
  contents: [
    { parts: [{ text: "..." }] },
    { parts: [{ inlineData: { mimeType: "image/jpeg", data: "base64..." } }] }
  ],
  config: {
    systemInstruction: "...",
    maxOutputTokens: 1024,
    responseModalities: ["IMAGE"],
    thinkingConfig: { thinkingLevel: "LOW" }
  }
}
```

---

### 2. OpenAI 兼容协议 (ph8 等第三方网关)

**适用场景**：商业模式、第三方代理节点

**端点格式**：
```
POST https://ph8.co/v1/chat/completions
POST https://ph8.co/v1/images/generations
```

**Chat 请求格式**：
```typescript
{
  model: "qwen3-vl-flash",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: [
      { type: "text", text: "..." },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }
    ]}
  ],
  temperature: 0.47,
  top_p: 0.95,
  max_tokens: 1024
}
```

**Image Generation 请求格式**：
```typescript
{
  model: "gemini-3.1-flash-image-preview",
  prompt: "...",
  size: "1024x1024",
  response_format: "b64_json",
  n: 1,
  seed: 123456,
  temperature: 0.47,
  top_p: 0.95,
  output_mime_type: "image/png",
  reference_images: [
    { data: "base64...", mime_type: "image/jpeg" }
  ]
}
```

---

## 二、协议选择逻辑

```typescript
// 判断是否使用第三方网关
if (node && node.provider !== "Google Cloud") {
  // 使用 OpenAI 兼容协议
  endpoint = `${proxiedUrl}/chat/completions`;
} else {
  // 使用 Gemini 原生协议
  endpoint = ai.models.generateContent({ ... });
}
```

---

## 三、局部修改功能的协议问题

### 当前问题

**局部修改请求体**：
```typescript
{
  model: "gemini-3.1-flash-image-preview",
  prompt: "请修改这张图片中【白色标记区域】的内容...",
  reference_images: [
    { data: "base64...", mime_type: "image/jpeg" }  // 只有底图
  ]
  // ❌ 缺少遮罩数据！
}
```

### 问题分析

1. **遮罩未传递**：`maskB` 数据没有被添加到请求体中
2. **协议不支持**：OpenAI 风格的 `/images/generations` 端点可能不支持局部修改
3. **参数格式未知**：需要确认 ph8 API 是否支持 `mask` 参数

---

## 四、可能的解决方案

### 方案 A：添加 mask 参数

```typescript
if (maskB && baseRefs.length > 0) {
  requestBody.reference_images = [
    { data: baseImageData, mime_type: "image/jpeg" }
  ];
  requestBody.mask = {
    data: maskBData,
    mime_type: "image/png"
  };
}
```

### 方案 B：使用 Gemini 原生协议

对于局部修改，强制使用 Gemini 原生 API：
```typescript
// 局部修改使用原生协议
if (maskB && baseRefs.length > 0) {
  // 使用 ai.models.generateContent() 而非 fetch
}
```

---

## 五、需要确认

1. ph8 API 是否支持局部修改功能？
2. 局部修改的正确参数格式是什么？
3. 是否需要使用不同的端点（如 `/images/edits`）？
