# 原厂 Temperature 逻辑对比分析

## 问题发现

### 原厂代码（开发模式 - Google 官方 API）

**第1267-1270行**：图像生成配置
```typescript
const genConfig: any = {
  responseModalities: [Modality.IMAGE],
  seed: Math.floor(Math.random() * 2147483647)
};
// ❌ 没有 temperature 参数！
```

**第1480-1485行**：视觉分析配置
```typescript
const genConfig: any = { 
  systemInstruction: instructions.VISUAL_ANALYST,
  maxOutputTokens: 2048
};
// ❌ 也没有 temperature 参数！
```

---

### 商业模式代码（ph8 API）

**第1151-1160行**：图像生成配置
```typescript
const dynamicTemperature = calculateTemperature(config.strictStructure);

const requestBody: any = {
  model: modelId,
  prompt: enhancedPrompt,
  size: imageSize,
  response_format: "b64_json",
  n: 1,
  seed: Math.floor(Math.random() * 2147483647),
  temperature: dynamicTemperature,  // ✅ 有 temperature 参数
  top_p: 0.95,
  output_mime_type: "image/png"
};
```

---

## 对比结论

| 模式 | API 类型 | temperature 参数 | 保真度联动 |
|------|---------|-----------------|-----------|
| **开发模式** | Google 官方 API | ❌ 未设置 | ❌ 无联动 |
| **商业模式** | ph8 API | ✅ 已设置 | ✅ 有联动 |

---

## 问题分析

### 原厂代码缺少 temperature 的原因

1. **Google 官方 Gemini 图像生成 API** 可能不支持 `temperature` 参数
2. 或者原厂代码未实现此功能

### 影响

- **开发模式**：保真度滑杆的值不会影响图像生成结果
- **商业模式**：保真度滑杆正确影响 temperature 参数

---

## 建议修改

### 方案：为原厂代码添加 temperature 支持

**修改位置**：`geminiService.ts` 第1267-1270行

**修改前**：
```typescript
const genConfig: any = {
  responseModalities: [Modality.IMAGE],
  seed: Math.floor(Math.random() * 2147483647)
};
```

**修改后**：
```typescript
const genConfig: any = {
  responseModalities: [Modality.IMAGE],
  seed: Math.floor(Math.random() * 2147483647),
  temperature: calculateTemperature(config.strictStructure)  // 添加 temperature
};
```

---

## 注意事项

需要确认 Google 官方 Gemini 图像生成 API 是否支持 `temperature` 参数。如果不支持，添加此参数可能会导致错误或被忽略。
