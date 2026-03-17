# 局部修改 502 错误排查指南

## 排查步骤

### 步骤1：打开 F12 开发者工具

按 `F12` 或右键点击页面选择"检查"，打开开发者工具。

---

### 步骤2：切换到 Console（控制台）标签

查看以下日志输出：

#### 2.1 查找请求信息

搜索以下关键词：
- `[Inpainting]`
- `[语义遮盖]`
- `[ph8格式]`

**需要记录的信息**：
```
[Inpainting] 使用 Pro 模型进行语义遮盖局部修改
[语义遮盖] 检测到 X 种颜色: ...
[语义遮盖] 已将遮罩叠加到底图，尺寸: XXXxXXX
[ph8格式] 端点: ...
[ph8格式] model: ...
[ph8格式] 底图数量: ...
[ph8格式] requestBody: ...
```

**请告诉我**：
1. `model` 是什么？
2. `底图数量` 是多少？
3. `requestBody` 的内容（特别是 `size` 和 `reference_images`）

---

### 步骤3：切换到 Network（网络）标签

#### 3.1 找到失败的请求

1. 点击"清除"按钮清空网络日志
2. 再次执行局部修改
3. 找到红色的请求（状态码 502）

#### 3.2 查看请求详情

点击失败的请求，查看以下信息：

**Headers（请求头）**：
- Request URL: `http://localhost:3000/api/ph8/images/generations`
- Request Method: `POST`
- Status Code: `502 Bad Gateway`

**Payload（请求体）**：
点击 "Payload" 标签，查看发送的数据：
```json
{
  "model": "gemini-3-pro-image-preview",
  "prompt": "...",
  "size": "1024x572",  // ← 注意这个尺寸
  "reference_images": [...]
}
```

**Response（响应）**：
```json
{
  "error": {
    "message": "Sorry, the network is a bit busy right now...",
    "type": "api_error",
    "code": "generation_failed"
  }
}
```

**请告诉我**：
1. `size` 的值是什么？
2. `reference_images` 数组有几个元素？
3. 响应内容是什么？

---

### 步骤4：对比普通生成的请求

#### 4.1 执行一次普通生成（带底图，不画遮罩）

1. 上传一张底图
2. 不画遮罩，直接生成
3. 查看网络请求

#### 4.2 对比两个请求的差异

**对比项目**：
| 项目 | 普通生成 | 局部修改 |
|------|---------|---------|
| model | ? | ? |
| size | ? | ? |
| reference_images 数量 | ? | ? |
| 请求体大小 | ? | ? |

---

### 步骤5：检查请求体大小

在 Console 中查看：
```
[请求体大小] XXXXX 字节 (XXX KB)
```

**如果超过 1MB**，可能是请求体过大导致的问题。

---

## 常见问题

### 问题1：尺寸非标准

如果 `size` 是 `1024x572` 这样的非标准尺寸，ph8 可能不支持。

**解决方案**：强制使用标准尺寸 `1024x1024`

### 问题2：reference_images 格式错误

检查 `reference_images` 的格式是否正确：
```json
"reference_images": [
  {
    "data": "base64数据...",
    "mime_type": "image/jpeg"
  }
]
```

### 问题3：请求体过大

如果请求体超过 1MB，可能导致超时或被拒绝。

**解决方案**：降低图像质量或尺寸

---

## 请提供以下信息

1. **Console 日志**：
   - `[ph8格式] requestBody:` 后面的内容

2. **Network 请求详情**：
   - `size` 的值
   - `reference_images` 数量
   - 响应内容

3. **普通生成 vs 局部修改的对比**：
   - 两个请求的差异
