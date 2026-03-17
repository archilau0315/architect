# 局部修改 502 错误分析

## 响应内容分析

```json
{
  "error": {
    "message": "Sorry, the network is a bit busy right now. Please try again later.",
    "type": "api_error",
    "code": "generation_failed"
  }
}
```

### 分析结论

这个错误信息表明 **ph8 服务器端问题**，但既然普通生成正常，只有局部修改失败，说明问题可能是：

---

## 需要进一步排查

### 请提供以下信息

#### 1. 请求体（Payload）内容

在 Network 标签中，点击 **Payload** 标签，查看发送的数据：

特别关注：
- `size` 的值是什么？（如 `1024x572`）
- `reference_images` 有几个元素？
- `prompt` 的内容是什么？

#### 2. 对比普通生成

请执行一次**普通生成**（上传底图，不画遮罩），然后对比：

| 项目 | 普通生成 | 局部修改 |
|------|---------|---------|
| model | ? | gemini-3-pro-image-preview |
| size | ? | ? |
| reference_images 数量 | ? | ? |
| 是否成功 | ✅ | ❌ |

---

## 可能的原因

### 原因1：尺寸问题

如果局部修改的 `size` 是非标准尺寸（如 `1024x572`），ph8 可能不支持。

**解决方案**：强制使用标准尺寸 `1024x1024`

### 原因2：reference_images 格式问题

局部修改发送的是**合成图**（底图+遮罩），格式可能与普通底图不同。

### 原因3：请求体过大

合成图的数据量可能比普通底图大很多，导致服务器处理超时。

---

## 下一步

请提供 **Payload（请求体）** 的内容，特别是：
1. `size` 的值
2. `reference_images` 的数量
3. `prompt` 的长度
