# ph8 视频 API 调试计划

## 问题分析

视频任务创建成功（返回了 task.id 和 status: "queued"），但状态查询一直返回 404。

## 可能的原因

1. **API 路径问题**：ph8 的视频 API 可能使用不同的路径格式
2. **认证问题**：状态查询可能需要不同的认证方式
3. **代理配置问题**：Vite 代理可能没有正确转发请求

## 调试步骤

### 步骤1：检查任务创建响应

任务创建成功时返回：
```json
{
  "id": "xxx",
  "status": "queued",
  "progress": 0.0
}
```

### 步骤2：检查状态查询请求

当前请求：`GET /api/ph8/videos/{id}`
返回：404 Not Found

### 步骤3：尝试不同的端点格式

根据 ph8 文档，可能需要：
- `GET /videos/{id}` - 当前使用
- `GET /videos?id={id}` - 查询参数格式
- `GET /video/{id}` - 单数形式
- `POST /videos/retrieve` - POST 方法

### 步骤4：检查代理配置

确保 Vite 代理正确转发所有视频相关请求。

## 解决方案

### 方案1：使用 POST 方法查询状态

```typescript
const statusResponse = await fetch(`${proxiedUrl}/videos/retrieve`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({ id: videoId })
});
```

### 方案2：使用单数形式端点

```typescript
const statusResponse = await fetch(`${proxiedUrl}/video/${videoId}`, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

### 方案3：直接轮询创建端点

有些 API 会返回任务状态，可以再次调用创建端点获取状态。

## 建议

1. 先尝试 POST 方法查询状态
2. 如果不行，尝试单数形式端点
3. 最后尝试直接轮询创建端点
