# F12 开发者工具 - Response（响应）查找指南

## Response 的不同名称

在 F12 开发者工具中，响应内容可能出现在以下位置：

---

### 1. Network（网络）标签

#### 找到请求后，点击请求名称

右侧会出现详情面板，包含以下标签：

| 标签名 | 说明 |
|--------|------|
| **Response** | 响应内容（原始文本） |
| **Preview** | 响应预览（JSON 格式化） |
| **Payload** | 请求体（发送的数据） |
| **Headers** | 请求头和响应头 |

**注意**：不同浏览器可能叫法不同：
- Chrome: `Response` 或 `Preview`
- Firefox: `Response` 或 `Response Body`
- Edge: `Response` 或 `Preview`

---

### 2. 如何找到 Response

#### 步骤1：切换到 Network 标签

```
开发者工具顶部标签：
Elements | Console | Sources | Network | ...
                              ↑ 点击这里
```

#### 步骤2：找到失败的请求

- 红色的请求 = 失败的请求
- 状态码显示 `502`

#### 步骤3：点击请求名称

点击请求名称（如 `generations`），右侧会出现详情面板

#### 步骤4：点击 Response 标签

```
右侧面板顶部标签：
Headers | Preview | Response | Timing | ...
                        ↑ 点击这里
```

---

### 3. 响应内容示例

成功响应：
```json
{
  "data": [
    {
      "b64_json": "base64图片数据..."
    }
  ]
}
```

错误响应：
```json
{
  "error": {
    "message": "Sorry, the network is a bit busy right now...",
    "type": "api_error",
    "code": "generation_failed"
  }
}
```

---

### 4. 如果找不到 Response

#### 情况1：请求还在进行中

等待请求完成（状态从 pending 变为 502）

#### 情况2：请求被过滤

检查 Network 标签的过滤器：
- 确保没有勾选 "All" 以外的选项
- 或者选择 "Fetch/XHR" 类型

#### 情况3：清空后重新请求

1. 点击"禁止"图标清空网络日志
2. 重新执行局部修改
3. 观察新出现的请求

---

### 5. 快捷方式

在 Console（控制台）中也可以看到响应内容：

搜索关键词：
- `[网关错误响应]`
- `[网关响应]`

示例：
```
[网关错误响应] HTTP Status: 502 Bad Gateway
[网关错误响应] 响应内容: {"error":{"message":"..."}}
```
