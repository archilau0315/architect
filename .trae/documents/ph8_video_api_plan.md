# ph8 视频 API 适配计划

## API 文档分析

### 端点
- `https://ph8.co/v1/videos`
- `https://ph8.co/openai/v1/videos`

### 请求格式

**简化模式**：
```json
{
  "model": "doubao-seedance-1-0-pro-fast-251015",
  "prompt": "...",
  "duration": 5,
  "resolution": "1080p",
  "ratio": "16:9",
  "image": "data:image/png;base64,..."  // i2v 模式
}
```

**高级模式**：
```json
{
  "model": "doubao-seedance-1-0-pro-fast-251015",
  "prompt": "...",
  "content": [
    { "type": "text", "text": "..." },
    { "type": "image_url", "image_url": {"url": "..."}, "role": "first_frame" }
  ],
  "resolution": "1080p",
  "generate_audio": false
}
```

### 响应处理

1. 创建任务后返回 `video.id` 和 `video.status`
2. 轮询状态：`in_progress` → `completed` 或 `failed`
3. 下载视频：`client.videos.download_content(video.id)`

---

## 修改计划

### 步骤1：修改请求端点

```typescript
// 端点改为 /videos
const response = await fetch(`${proxiedUrl}/videos`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: remoteModelId,
    prompt: prompt,
    duration: 5,
    resolution: "1080p",
    ratio: aspectRatio,
    image: assets[0]  // 如果有图片
  })
});
```

### 步骤2：添加任务轮询

```typescript
// 创建任务
const task = await response.json();
const videoId = task.id;

// 轮询状态
while (task.status === "in_progress" || task.status === "queued") {
  await new Promise(resolve => setTimeout(resolve, 2000));
  const statusResponse = await fetch(`${proxiedUrl}/videos/${videoId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const status = await statusResponse.json();
  if (status.status === "completed") {
    return { url: status.url || status.content_url, videoRef: videoId };
  }
  if (status.status === "failed") {
    throw new Error(status.error?.message || "Video generation failed");
  }
}
```

### 步骤3：更新 Vite 代理配置

确保 `/api/ph8/videos` 路由正确代理到 `https://ph8.co/v1/videos`。

---

## 代码修改位置

**文件**：`services/geminiService.ts`
**函数**：`generateVideo`
**行号**：1934-2020

---

## 修改后的完整逻辑

1. 使用 `/videos` 端点创建任务
2. 获取任务 ID
3. 轮询 `/videos/{id}` 获取状态
4. 状态为 `completed` 时返回视频 URL
5. 状态为 `failed` 时抛出错误
