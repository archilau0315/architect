# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 常用命令

```bash
# 开发：前端（端口 3000）+ 后端需单独启动
npm run dev                          # 启动前端开发服务器 (Vite)
cd backend && node server.js          # 启动后端服务器 (端口 3001)

# 构建 & 检查
npm run build                         # 构建前端到 dist/
npm run lint                          # TypeScript 类型检查 (tsc --noEmit)
npm run preview                       # 预览生产构建

# 部署流程（本地→服务器）
npm run build → 删 dist/assets/ 无用文件 → 上传 dist/ + backend/ 到服务器 → pm2 restart kbitai-api → nginx -s reload
```

## 项目架构概览

本项目是 **首席图像架构师** — 一个 AI 创意设计平台，前后端分离，部署于 `www.kbitai.com.cn`。

### 技术栈

| 层 | 技术 | 关键依赖 |
|---|------|----------|
| 前端 | React 19 + TypeScript + Vite 6 | Redux Toolkit, FFmpeg WASM, Google GenAI SDK |
| 后端 | Node.js + Express | mysql2, JWT, multer |
| 数据库 | MySQL 5.7+ (数据库名 kbitai0302) | — |
| 部署 | Nginx + PM2 | SSL: www.kbitai.com.cn |

### 前端核心结构

**入口**: `App.tsx` — 根组件，管理全局状态（用户等级、积分、标签页、会话等），定义 `TIER_CONFIG` 用户等级配置。

**布局体系**: `Layout.tsx` → 侧边栏 + 顶栏 + 主内容区。主内容区根据 `activeTab` 切换：
- `ConversationView.tsx` — 聊天/渲染视图，包含 ChatBot 对话界面
- `ImageGenerator.tsx` — 图像生成（文生图、图生图、Inpaint）
- `VideoGenerator.tsx` — 视频生成（KbitVeo 引擎），含分层预览和权限下载
- `ImageAnalyzer.tsx` — 图像分析
- `SettingsPanel.tsx` — 设置面板（界面偏好、账户、订阅、协议等）

**服务层** (`services/`)：
- `geminiService.ts` — 核心 AI 服务，包含 `getAI(modelId)` 函数，通过网关配置解析 apiKey 并调用 Google GenAI SDK 或代理路由
- `chatService.ts` / `imageService.ts` — 聊天和图像生成逻辑
- `videoWatermarkService.ts` — 客户端 FFmpeg WASM 视频水印烧录
- `watermarkService.ts` — 图像水印服务
- `apiService.ts` / `apiClient.ts` — HTTP 请求封装，含代理 URL 处理

**多语言**: `i18n/locales.ts` 定义了 zh-CN, en-US, ja-JP, ko-KR, es-ES, fr-FR, de-DE, ru-RU 共 8 种语言的完整翻译。

**网关系统**: `config/gateway_config.json` 配置 AI 模型节点路由（provider, url, remoteModelId, priority）。`services/geminiService.ts` 的 `getNextApiKey()` 从此文件读取模型对应的 API 密钥和路由地址。视频模型前缀为 `KbitVeo-*`（speed/normal/standard/pro）。

### 后端结构 (`backend/`)

入口 `server.js`，Express 应用。关键路由：
- `routes/ph8.js` — PH8 代理 API（图像/视频生成的中转）
- `routes/gateway.js` — 网关路由（模型调度、余额查询）
- `routes/invite.js` — 邀请码验证与注册
- `routes/usage.js` — 使用量统计与权限校验（含视频下载验证接口）
- `routes/beta.js` — 内测申请管理
- `routes/upload.js` — 文件上传

### 关键设计模式

1. **多网关智能路由**: 同一模型可配置多个 provider 节点，按优先级/价格排序，支持 failover 自动切换。
2. **用户等级体系**: free(0) < beta(1) < basic(3) < pro(5) < dev(∞)，等级影响每日额度、功能解锁（如无水印下载）。
3. **客户端水印**: 使用 FFmpeg WASM 在浏览器端完成视频水印烧录，避免服务器负载。
4. **双层下载校验**: 视频无水印下载先调后端 `/api/usage/video-download/check` 验证 DB 中的用户等级和日用量，失败时降级到 localStorage 检查。
5. **localStorage 状态持久化**: 用户偏好、等级、积分、会话等均存 localStorage，键名带版本号后缀（如 `-v120`、`-v150`）。

## 重要规则（来自 CLAUDE.md）

- **UI 保护优先**: 严禁修改 UI 布局和组件功能，修改代码必须遵循最小化原则且先汇报讨论
- **publicDir 配置**: Vite 的 `publicDir` 设置为 `'../public'`，静态资源引用路径为 `/public/xxx`
- **API 地址**: 开发环境 `localhost:3001`，生产环境 `https://api.kbitai.com.cn`
- **Logo 路径**: 水印Logo=`LOGOkbitwater.png`, 公司Logo=`Com_Logo.png`, 应用Logo=`archi01.png`，均位于 `../public/` 和服务器 `/www/wwwroot/kbitai.com.cn/public/`

## 故障排查速查

| 错误 | 排查方向 |
|------|---------|
| CORS 错误 | 检查 Nginx 反向代理头 和后端 CORS 中间件 |
| 404 | 检查 API 路径是否匹配 backend/routes/ 中的路由定义 |
| "API key is missing" | 检查 `config/gateway_config.json` 是否有对应 modelId 的节点配置 |
| 502 | 后端服务未运行或端口不匹配，检查 `pm2 list` |
| 数据库错误 | 检查 `backend/.env` 中 MySQL 连接配置 |
