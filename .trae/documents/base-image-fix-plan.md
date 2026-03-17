# 底图不起作用问题诊断与修复方案

## 一、问题诊断

### 代码分析

在 `geminiService.ts` 中发现严重问题：

**第1068行** - 正确提取了 parts 中的提示词：
```typescript
const prompt = parts.find(p => p.text)?.text || "";  // ✅ 提取增强后的提示词
```

**第1071行** - 正确提取了图片数据：
```typescript
const imageParts = parts.filter(p => p.inlineData);  // ✅ 提取底图
```

**但是第1200行** - 错误地使用了原始 prompt 参数：
```typescript
const requestBody: any = {
  model: modelId,
  prompt: prompt,  // ❌ 这里的 prompt 是函数参数，不是 parts 中的增强提示词！
  ...
};
```

### 问题根因

**变量名冲突！**

- 第659行函数参数：`prompt: string` - 原始用户输入
- 第1068行局部变量：`const prompt = parts.find(p => p.text)?.text` - 增强后的提示词

由于JavaScript的变量提升和作用域规则，第1068行的 `const prompt` 被提升到了try块顶部，但在第1200行使用时，可能因为作用域问题使用了函数参数的原始 `prompt`。

### 日志验证

控制台应该显示：
```
Prompt: [原始用户输入]...  // 而不是增强后的构图约束提示词
```

---

## 二、修复方案

### 方案：重命名变量避免冲突

```typescript
// 修改第1068行
const enhancedPrompt = parts.find(p => p.text)?.text || "";

// 修改第1200行
const requestBody: any = {
  model: modelId,
  prompt: enhancedPrompt,  // ✅ 使用增强后的提示词
  ...
};
```

### 同时修复底图传递

ph8网关使用OpenAI格式，底图应该通过 `extra_body.reference_images` 传递，但需要确保格式正确：

```typescript
if (imageParts.length > 0) {
  requestBody.extra_body = {
    reference_images: imageParts.map((img: any) => ({
      data: img.inlineData.data,
      mime_type: img.inlineData.mimeType
    })),
    temperature: 0.85,  // 低温度，更遵循底图
    top_p: 0.95,
    output_mime_type: "image/png"
  };
}
```

---

## 三、修复步骤

### 步骤1：重命名变量

修改 `geminiService.ts` 第1068行：
```typescript
// 之前
const prompt = parts.find(p => p.text)?.text || "";

// 之后
const enhancedPrompt = parts.find(p => p.text)?.text || "";
```

### 步骤2：使用增强提示词

修改第1200行：
```typescript
// 之前
prompt: prompt,

// 之后
prompt: enhancedPrompt,
```

### 步骤3：更新日志

修改第1079行：
```typescript
// 之前
console.log(`Prompt: ${prompt.substring(0, 100)}...`);

// 之后
console.log(`Prompt: ${enhancedPrompt.substring(0, 100)}...`);
```

### 步骤4：更新其他引用

检查并更新所有使用 `prompt` 变量的地方，确保使用 `enhancedPrompt`。

---

## 四、验证方法

修复后，控制台应该显示：

```
[构图约束] 普通模式宽高比: 3:4
[ph8] 生成第 1/1 张图片, seed: XXX
Prompt: 【CRITICAL COMPOSITION REQUIREMENTS - MUST FOLLOW】...  // ✅ 增强后的提示词
底图数量: 1
```

---

## 五、关于ph8格式

ph8网关使用的是 **OpenAI 兼容格式**：

```json
{
  "model": "gemini-3.1-flash-image-preview",
  "prompt": "提示词",
  "size": "1024x1024",
  "response_format": "b64_json",
  "n": 1,
  "extra_body": {
    "reference_images": [
      { "data": "base64...", "mime_type": "image/jpeg" }
    ],
    "temperature": 0.85
  }
}
```

`reference_images` 参数应该能让模型参考底图，但需要正确的提示词配合才能生效。

---

## 六、总结

**根本原因**：变量名冲突导致使用了原始提示词，而不是增强后的构图约束提示词。

**修复方案**：重命名变量为 `enhancedPrompt`，确保使用正确的提示词。
