# 《人工智能生成合成内容标识办法》合规性实施方案

## 一、当前状态

### ✅ 已满足
1. 图片显式水印（右下角Logo）
2. 视频显式水印（右下角Logo）
3. 下载日志记录（localStorage）

### ❌ 必须补充
1. ChatBot回复AI生成提示（文本显式标识）
2. 图片/视频隐式标识（元数据写入）
3. 内容编号系统
4. 用户服务协议
5. 后端日志存储（6个月）

### ⚠️ 已决定
- 取消高清原片下载功能
- 数字水印暂不实施（鼓励性，非强制）

---

## 二、实施计划

### 任务1：ChatBot回复AI生成提示
**优先级：** P0
**文件：** `components/ChatBot.tsx`
**内容：** 在AI回复末尾添加 `[AI生成内容]` 标签

### 任务2：内容编号生成服务
**优先级：** P0
**文件：** `services/contentIdService.ts`（新建）
**内容：** 生成唯一内容编号，格式 `KBITAI-YYYYMMDD-XXXXXX`

### 任务3：图片元数据写入
**优先级：** P0
**文件：** `services/watermarkService.ts`
**依赖：** `npm install piexifjs`
**内容：** 在图片EXIF中写入AI生成标识、平台名称、内容编号

### 任务4：视频元数据写入
**优先级：** P0
**文件：** `services/videoWatermarkService.ts`
**内容：** 使用FFmpeg添加视频元数据

### 任务5：用户服务协议
**优先级：** P1
**文件：** `components/SettingsPanel.tsx`
**内容：** 添加用户协议页面，说明标识方法

### 任务6：后端日志存储
**优先级：** P1
**文件：** `backend/server.js`、`backend/database.sql`
**内容：** 日志存储到MySQL，保留6个月

### 任务7：取消高清原片下载
**优先级：** P1
**文件：** `components/ImageGenerator.tsx`、`components/VideoGenerator.tsx`
**内容：** 移除高清原片下载按钮

---

## 三、实施顺序

1. ChatBot回复AI生成提示（0.5小时）
2. 内容编号生成服务（1小时）
3. 图片元数据写入（2小时）
4. 视频元数据写入（1小时）
5. 取消高清原片下载（0.5小时）
6. 用户服务协议（1小时）
7. 后端日志存储（2小时）

**总计：** 约8小时
