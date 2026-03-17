# ph8 生图代码分析与优化计划

## 一、ph8 技术人员代码分析

### 代码结构

```python
result = client.images.generate(
    model="gemini-3-pro-image-preview",
    prompt="提示词...",
    size="1024x1024",
    response_format="b64_json",
    n=1,
    extra_body={
        "reference_images": [
            {
                "file_uri": image_url,  # 或 "data": base64_data
                "mime_type": "image/jpeg"
            }
        ],
        "temperature": 1.0,
        "top_p": 0.95,
        "output_mime_type": "image/png"
    }
)
```

### 关键发现

1. **底图传递方式**：使用 `extra_body.reference_images` 字段
2. **参考图像格式**：支持 `file_uri`（URL）或 `data`（base64）
3. **温度参数**：`temperature: 1.0`（较高，保持创造性）
4. **输出格式**：`output_mime_type: "image/png"`

---

## 二、当前代码与 ph8 代码对比

| 参数 | ph8 代码 | 当前代码 | 差异 |
|------|---------|---------|------|
| 底图传递 | `extra_body.reference_images` | `image` + `strength` | ❌ 不一致 |
| 温度 | `temperature: 1.0` | 无 | ❌ 缺失 |
| top_p | `top_p: 0.95` | 无 | ❌ 缺失 |
| 输出格式 | `output_mime_type: "image/png"` | 无 | ❌ 缺失 |

### 问题根源

当前代码使用 `image` + `strength` 字段传递底图，但 ph8 实际使用 `extra_body.reference_images` 字段。这是导致底图和成图不一致的主要原因！

---

## 三、修改优化计划

### 修改内容

1. **修改底图传递方式**：使用 `extra_body.reference_images` 替代 `image` + `strength`
2. **添加温度参数**：`temperature: 1.0`
3. **添加 top_p 参数**：`top_p: 0.95`
4. **添加输出格式参数**：`output_mime_type: "image/png"`

### 修改后的请求体格式

```typescript
const requestBody: any = {
  model: modelId,
  prompt: enhancedPrompt,
  size: imageSize,
  response_format: "b64_json",
  n: 1,
  seed: Math.floor(Math.random() * 2147483647),
  extra_body: {
    reference_images: imageParts.map((img: any) => ({
      data: img.inlineData.data,
      mime_type: img.inlineData.mimeType
    })),
    temperature: 1.0,
    top_p: 0.95,
    output_mime_type: "image/png"
  }
};
```

---

## 四、实施步骤

### 步骤 1：修改请求体格式

- 移除 `image` + `strength` 字段
- 添加 `extra_body.reference_images` 字段
- 添加 `temperature`、`top_p`、`output_mime_type` 参数

### 步骤 2：测试验证

- 测试单张底图场景
- 测试多张底图场景（线稿 + 语义分割图）
- 验证底图和成图一致性

---

## 五、预期效果

- 底图和成图保持一致
- 建筑形状、位置、比例与底图匹配
- 透视关系正确
- 边界清晰，无模糊或偏移
