# 首席图像架构师 Code Wiki

> 项目名称：首席图像架构师（Chief Image Architect）
> 所属域名：[www.kbitai.com.cn](https://www.kbitai.com.cn)
> 子应用路径：`/architect/`
> 文档版本：v1.0
> 最后更新：2026-08-18

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构](#2-整体架构)
3. [技术栈与依赖](#3-技术栈与依赖)
4. [目录结构](#4-目录结构)
5. [前端模块职责](#5-前端模块职责)
6. [后端模块职责](#6-后端模块职责)
7. [关键类与函数说明](#7-关键类与函数说明)
8. [数据流与依赖关系](#8-数据流与依赖关系)
9. [数据库设计](#9-数据库设计)
10. [项目运行方式](#10-项目运行方式)
11. [部署流程](#11-部署流程)
12. [API 接口清单](#12-api-接口清单)
13. [核心业务流程](#13-核心业务流程)
14. [安全机制](#14-安全机制)

---

## 1. 项目概述

### 1.1 项目定位

"首席图像架构师"是天津匡形无界智能科技有限公司旗下 **KbitAI 平台**的子应用，部署于 `https://www.kbitai.com.cn/architect/`。它是一个面向创意设计领域的 **AI 生成内容（AIGC）工作站**，集成图像生成、视频生成、对话、图像分析、联网搜索、图像修复（Inpainting）等多种能力。

### 1.2 核心能力

| 能力域 | 说明 |
| ------ | ---- |
| AI 对话 | 基于 Gemini 多模态模型的会话与提示词渲染 |
| 图像生成 | 通过商业网关代理 Gemini 图像模型生成创意图 |
| 视频生成 | 通过 PH8（WellAI）网关生成动态视频 |
| 图像分析 | 联网搜索（百度/Tavily）+ 图像理解 |
| 图像修复 | Inpaint 局部重绘编辑器 |
| 积分体系 | 多层级用户配额、邀请码、支付充值 |
| 管理后台 | 用户、订单、配置、日志管理 |

### 1.3 访问地址

| 功能 | 地址 |
| ---- | ---- |
| 前端应用 | https://www.kbitai.com.cn/architect/ |
| 后端 API | https://api.kbitai.com.cn |
| 管理后台 | https://www.kbitai.com.cn/admin/ |
| PH8 代理 | https://api.kbitai.com.cn/api/ph8 |

---

## 2. 整体架构

### 2.1 架构总览

项目采用 **前后端分离 + 独立 API 域名** 的三层架构：

```
┌──────────────────────────────────────────────────────────────┐
│                         浏览器客户端                          │
│  www.kbitai.com.cn/architect/  (React SPA, Vite 构建)        │
└────────────┬───────────────────────────────┬─────────────────┘
             │ /api/* 请求                    │ /api/ph8/* 视频/图像
             ▼                                ▼
┌─────────────────────────┐       ┌──────────────────────────┐
│  前端服务器 (Nginx)      │       │   后端 API 服务器        │
│  提供静态资源 + 反向代理 │       │  api.kbitai.com.cn       │
│  www.kbitai.com.cn      │       │  Express + PM2 (port 3001)│
└────────────┬────────────┘       └──────────┬───────────────┘
             │                                │
             └─────────────┬──────────────────┘
                           ▼
            ┌──────────────────────────────────┐
            │          后端服务层               │
            │  • MySQL (kbitai0302)            │
            │  • Redis 缓存                    │
            │  • PH8/WellAI 网关代理           │
            │  • 支付宝/微信支付               │
            │  • SMTP 邮件 (126 邮箱)          │
            └──────────────────────────────────┘
```

### 2.2 三大子域

1. **前端应用**（本仓库根目录）：React 19 + TypeScript + Vite 单页应用，负责 UI、用户交互、localStorage 状态持久化。
2. **后端 API**（`backend/` 目录）：Node.js + Express，提供业务接口、积分扣减、PH8 网关代理、管理后台服务。
3. **管理后台**（`backend/admin/*.html`）：纯静态 HTML 页面，由后端 Express 直接托管于 `/admin` 路径。

### 2.3 关键设计原则

- **API Key 不入前端**：所有第三方密钥（Gemini、PH8、百度、Tavily）由后端管理，前端通过 `/api/ph8`、`/api/gateway` 代理访问。
- **单一事实来源**：用户等级配置统一在 [tierConfig.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/config/tierConfig.js) 与前端 [App.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/App.tsx#L42-L48) 的 `TIER_CONFIG`。
- **乐观更新 + 后端校验**：前端扣减积分先更新 UI，再异步请求后端做最终校验。
- **localStorage 持久化**：用户会话、偏好设置、积分快照等通过 localStorage 跨刷新保留。

---

## 3. 技术栈与依赖

### 3.1 前端依赖（[package.json](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/package.json)）

| 依赖 | 版本 | 用途 |
| ---- | ---- | ---- |
| react / react-dom | ^19.2.4 | UI 框架 |
| @reduxjs/toolkit / react-redux | ^2.11.2 / ^9.2.0 | 状态管理 |
| @google/genai | 1.35.0 | Gemini SDK |
| tailwindcss / @tailwindcss/vite | ^4.2.4 | 原子化 CSS |
| lucide-react | ^0.575.0 | 图标库 |
| @ffmpeg/* | ^0.12.x | 浏览器端视频处理 |
| piexifjs | ^1.0.6 | 图片 EXIF 元数据写入 |
| vite | ^6.2.0 | 构建工具 |
| typescript | ~5.8.2 | 类型系统 |

### 3.2 后端依赖（[backend/package.json](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/package.json)）

| 依赖 | 版本 | 用途 |
| ---- | ---- | ---- |
| express | ^4.18.2 | Web 框架 |
| mysql2 | ^3.20.0 | MySQL 连接池（Promise） |
| redis | ^5.11.0 | 缓存 |
| jsonwebtoken | ^9.0.3 | JWT 认证 |
| bcrypt | ^6.0.0 | 密码哈希 |
| cors | ^2.8.5 | CORS（实际由 Nginx 处理） |
| dotenv | ^16.3.1 | 环境变量 |
| multer | ^1.4.5-lts.1 | 文件上传 |
| nodemailer | ^8.0.4 | 邮件发送 |
| axios | ^1.13.6 | HTTP 客户端 |
| uuid | ^9.0.0 | 唯一 ID |
| validator | ^13.15.35 | 输入校验/转义 |
| alipay-sdk | ^4.14.0 | 支付宝支付 |
| wechatpay-node-v3 | ^2.2.1 | 微信支付 |
| qrcode | ^1.5.4 | 二维码生成 |
| nodemon | ^3.0.1 | 开发热重载（dev） |

---

## 4. 目录结构

### 4.1 顶层结构

```
Architect(NewUI)/
├── App.tsx                  # 前端根组件
├── index.tsx                # 前端入口（挂载 Redux + 路由分流）
├── index.html               # HTML 模板
├── index.css / fonts.css    # 全局样式
├── constants.ts             # 常量（AVATAR_KEY 等）
├── types.ts                 # 全局 TS 类型
├── vite.config.ts           # Vite 构建配置
├── tsconfig.json            # TS 配置
├── package.json             # 前端依赖
├── components/              # 业务组件
├── services/               # 前端服务层
├── src/                    # Redux store、hooks、全局样式
├── i18n/                   # 多语言
├── legal/                  # 法律文本
├── backend/                # 后端代码
├── database/               # 数据库脚本
├── deploy/                 # 部署配置（Nginx、同步脚本）
├── DOCS/                   # 文档
├── public/                 # 静态资源（Logo）
└── tests/                  # 测试
```

### 4.2 后端结构（`backend/`）

```
backend/
├── server.js               # 入口：挂载路由、中间件、定时任务
├── db.js                   # MySQL 连接池 + 监控
├── ecosystem.config.js     # PM2 配置
├── database.sql            # 数据库初始化脚本
├── controllers/            # 业务控制器
│   ├── authController.js       # 登录/密码重置
│   ├── userController.js       # 用户信息/配额/扣减
│   ├── contentController.js    # 内容注册/下载日志
│   ├── adminController.js      # 管理后台接口
│   └── analyzeController.js   # 图像分析
├── routes/                 # 路由模块
│   ├── invite.js   payment.js  ph8.js   ph8Balance.js
│   ├── gateway.js  upload.js   usage.js  beta.js
│   ├── plan.js     search.js   analyze.js  watermark.js
├── services/               # 服务层（第三方集成）
│   ├── ph8TokenService.js      # 积分/用量记录
│   ├── geminiService.js        # Gemini 调用
│   ├── cacheService.js         # Redis
│   ├── loggerService.js        # 结构化日志
│   ├── mailService.js          # 邮件
│   ├── imageWatermarkService.js
│   ├── alipayService.js / wechatPayService.js
│   ├── baiduImageSearchService.js / baiduSearchService.js
│   ├── tavilyService.js / tavilyIntegration.js / searchDispatcher.js
│   ├── contentIdService.js / monitoringService.js
│   └── textAnalyzer.js
├── middleware/             # 中间件
│   ├── auth.js             # JWT 用户认证
│   ├── adminAuth.js        # 管理员 JWT（verifyAdminToken）
│   ├── validation.js       # 输入清理 + SQL 注入防护
│   ├── errorHandler.js     # 统一错误处理
│   ├── monitoring.js       # 请求监控
│   └── usageLimiter.js     # 用量限制
├── config/                 # 配置
│   ├── tierConfig.js       # 用户等级配额
│   └── paymentConfig.js    # 支付配置
└── admin/                  # 管理后台静态页
    ├── index.html dashboard.html users.html models.html
    ├── payments.html logs.html beta.html reset-password.html
```

---

## 5. 前端模块职责

### 5.1 入口与根组件

#### [index.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/index.tsx)

- 检测 `/admin/reset-password` 路径并重定向到后端管理页。
- 通过 `ReactDOM.createRoot` 挂载 `<App/>`，外层包裹 Redux `<Provider store={store}>`。
- 引入全局样式 `src/styles/global.css` 与 `index.css`。

#### [App.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/App.tsx)

应用核心容器，承担以下职责：

- **初始化流程**（`initApp`，[L134-L431](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/App.tsx#L134-L431)）：
  - 读取 localStorage 偏好/模型/版本历史/会话。
  - 调用 `/api/ph8/user-info` 获取用户等级，检测等级过期降级。
  - 调用 `/api/user/quota` 同步后端真实余额，每 30s 轮询刷新。
  - 设置 Gemini SDK 的 token 上报回调。
  - 强制启用商业网关模式。
- **积分管理**（`handleConsumePoints`，[L599-L696](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/App.tsx#L599-L696)）：
  - 防重放锁 `__consumePointsLock`。
  - 本地余额预检 → 调用 `/api/user/consume` → 乐观更新 UI → 再次同步后端。
- **偏好应用**（`handlePreferencesChange`）：将主题色、圆角、密度、动画速度、字号写入 `document.documentElement` CSS 变量。
- **开发者模式**（`handleToggleDeveloper`）：密码校验后切换，时间恒定哈希比较。
- **路由分发**：根据 `activeTab` 在 `ConversationView`（对话/渲染）与 `VideoGenerator`（视频工作台）间切换。

### 5.2 业务组件（`components/`）

| 组件 | 文件 | 职责 |
| ---- | ---- | ---- |
| Layout | [Layout.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/components/Layout.tsx) | 侧边栏导航、领域切换（建筑/产品/艺术/角色）、Tab 切换、会话树、主题切换、Logo/头像 |
| ConversationView | ConversationView.tsx | Gemini 风格对话界面，支持流式响应、图像渲染、视频回写、预设面板 |
| VideoGenerator | VideoGenerator.tsx | 动漫导演控制台，PH8 视频生成、轮询、水印 |
| ImageGenerator | ImageGenerator.tsx | 图像生成工作台 |
| InpaintEditor | InpaintEditor.tsx | 图像局部修复编辑器（笔刷/矩形/多边形） |
| SettingsPanel | SettingsPanel.tsx | 设置面板：偏好、模型管理、版本回滚、积分、订阅、开发者模式 |
| InviteVerify | InviteVerify.tsx | 邀请码注册/登录 |
| PasswordReset | PasswordReset.tsx | 密码重置 |
| ScreenshotCropper | ScreenshotCropper.tsx | 截图裁剪 |
| UnifiedInput / InputField | UnifiedInput.tsx / InputField.tsx | 统一输入控件 |
| UserAvatar | UserAvatar.tsx | 用户头像（localStorage 持久化） |
| SystemSpec | SystemSpec.tsx | 系统提示词编辑 |
| BetaApplicationBanner | BetaApplicationBanner.tsx | 内测申请横幅 |
| VideoPlayer | VideoPlayer.tsx | 视频播放器 |

### 5.3 前端服务层（`services/`）

| 服务 | 职责 |
| ---- | ---- |
| [geminiService.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/services/geminiService.ts) | Gemini SDK 封装、`getProxiedUrl`（请求代理）、`getCurrentUserId`、token 上报、系统预设 |
| apiService.ts / apiClient.ts | 通用 API 调用封装 |
| imageService.ts | 图像生成/处理 |
| videoBlobService.ts | 视频 blob 管理（URL 失效恢复） |
| videoWatermarkService.ts / watermarkService.ts | 水印 |
| styleTransferService.ts | 风格迁移 |
| contentIdService.ts | 内容 ID（AI 标识合规） |
| chatService.ts | 对话会话 |
| avatarService.ts | 头像服务 |
| configService.ts | 配置 |
| errorService.ts | 错误处理 |
| ph8UsageService.ts | PH8 用量查询 |

### 5.4 Redux Store（[src/store/](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/src/store)）

| Slice | 文件 | 状态字段 |
| ----- | ---- | -------- |
| user | [userSlice.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/src/store/userSlice.ts) | tier、dailyPoints、purchasedPoints、bonusPoints、avatar、needsInviteVerify 等 |
| app | [appSlice.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/src/store/appSlice.ts) | activeTab、currentDomain、gateway 开关、token 监控 |
| preferences | preferencesSlice.ts | 主题、语言、字号、密度等 |
| models | modelsSlice.ts | 自定义模型列表、激活模型 |
| system | systemSlice.ts | 系统预设、版本历史 |

> 注：App.tsx 大量使用 useState 而非 Redux，Redux store 当前作为补充状态容器与未来扩展预留。

### 5.5 多语言与法律

- [i18n/locales.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/i18n/locales.ts)：支持 zh-CN / en-US / ja-JP / ko-KR / es-ES / fr-FR / de-DE / ru-RU，提供 `getTranslation`。
- [legal/privacyPolicy.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/legal/privacyPolicy.ts) 与 [legal/termsOfService.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/legal/termsOfService.ts)：隐私政策与服务条款。

---

## 6. 后端模块职责

### 6.1 入口 [server.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/server.js)

启动流程与关键中间件顺序：

1. `dotenv` 加载环境变量。
2. `criticalEnvCheck()` 校验 `JWT_SECRET`。
3. 管理员登录限流中间件（15 分钟 5 次失败锁定）。
4. 全局中间件链：`requestLogger` → `sqlInjectionProtection` → `validateRequest` → `monitoringMiddleware`。
5. 静态托管 `/admin`。
6. 挂载各路由模块（见 [§12](#12-api-接口清单)）。
7. 直连路由：`/api/auth/*`、`/api/user/*`、`/api/content/*`、`/api/admin/*`。
8. 定时任务 `scheduleDailyReset()`：每日 0:00 重置每日/每月用量。
9. 监控任务 `setupMonitoringTasks()`。
10. 数据库状态、健康检查、缓存管理、日志管理 API。
11. 错误处理中间件：`errorLogger` → `notFound` → `errorHandler`。
12. Redis 初始化、监听端口 3001。

### 6.2 数据库层 [db.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/db.js)

- 基于 `mysql2/promise` 创建连接池（`connectionLimit: 10`）。
- 监听 `acquire`/`release`/`enqueue`/`connection` 事件统计连接池状态。
- 包装 `query`/`execute` 方法加入慢查询监控（阈值 1000ms）。
- 导出 `getPoolStatus`、`healthCheck`、`resetStats`、`dbMonitor`（EventEmitter）。
- 启动时校验 `DB_HOST/DB_USER/DB_PASSWORD/DB_DATABASE`。

### 6.3 控制器（`controllers/`）

| 控制器 | 关键方法 | 职责 |
| ------ | -------- | ---- |
| [authController.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/controllers/authController.js) | `login`、`forgotPassword`、`verifyResetToken`、`resetPassword` | 用户登录（bcrypt 校验）、密码重置令牌 |
| [userController.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/controllers/userController.js) | `getUserInfo`、`getQuota`、`consumePoints`、`updateNickname` | 用户信息、配额查询（含每日重置、等级过期降级）、积分扣减 |
| [contentController.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/controllers/contentController.js) | `registerContent`、`verifyContent`、`logDownload` | 内容 ID 注册与下载日志（AI 内容合规） |
| [adminController.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/controllers/adminController.js) | `login`、`getUsers`、`getDashboard`、`approveBetaRequest`、`manualSendInvite` 等 | 管理后台全量接口 |
| [analyzeController.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/controllers/analyzeController.js) | 图像分析接口 | 联网搜索 + 图像理解 |

### 6.4 路由（`routes/`）

| 路由文件 | 挂载路径 | 职责 |
| -------- | -------- | ---- |
| [invite.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/invite.js) | `/api/invite` | 邀请码生成（管理员）、验证、注册 |
| [payment.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/payment.js) | `/api/payment` | 支付下单、回调、查询 |
| [ph8.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/ph8.js) | `/api/ph8`、`/api/ph8/openai/v1` | PH8 网关代理（视频/图像），含模型定价表 |
| [ph8Balance.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/ph8Balance.js) | `/api/ph8`（前置） | PH8 余额查询（需在 ph8Routes 前加载避免通配符捕获） |
| [gateway.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/gateway.js) | `/api/gateway/:gatewayKey/*` | 通用多网关代理 |
| [usage.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/usage.js) | `/api/usage` | 用量日志 |
| [beta.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/beta.js) | `/api/beta` | 内测申请 |
| [plan.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/plan.js) | `/api/plan` | 订阅套餐 |
| [search.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/search.js) | `/api/search` | 联网搜索（百度/Tavily调度） |
| [analyze.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/analyze.js) | `/api/analyze` | 图像分析 |
| [upload.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/upload.js) | `/api/upload` | 文件上传（multer） |
| [watermark.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/watermark.js) | `/api/watermark` | 水印服务 |

### 6.5 服务层（`services/`）

| 服务 | 职责 |
| ---- | ---- |
| [ph8TokenService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/ph8TokenService.js) | 用量记录 `recordUsage`、余额扣减 `deductBalance`、充值 `rechargeBalance`、每日/每月重置、token→积分换算（1000 积分/元） |
| [geminiService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/geminiService.js) | 后端 Gemini 调用封装 |
| [cacheService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/cacheService.js) | Redis 缓存（带重试策略、降级容忍） |
| [loggerService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/loggerService.js) | 结构化日志、`requestLogger`/`errorLogger`、日志文件读写 |
| [mailService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/mailService.js) | SMTP 邮件（126 邮箱） |
| [imageWatermarkService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/imageWatermarkService.js) | 图片水印 |
| [alipayService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/alipayService.js) / [wechatPayService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/wechatPayService.js) | 支付宝/微信支付 |
| [baiduImageSearchService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/baiduImageSearchService.js) / [baiduSearchService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/baiduSearchService.js) | 百度图像/网页搜索 |
| [tavilyService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/tavilyService.js) / [tavilyIntegration.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/tavilyIntegration.js) | Tavily 海外联网搜索 |
| [searchDispatcher.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/searchDispatcher.js) | 搜索引擎调度（按场景/地区分发） |
| [contentIdService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/contentIdService.js) | AI 内容标识 ID 生成与校验（合规） |
| [monitoringService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/monitoringService.js) | 运行时监控 |
| [textAnalyzer.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/textAnalyzer.js) | 文本分析 |

### 6.6 中间件（`middleware/`）

| 中间件 | 文件 | 职责 |
| ------ | ---- | ---- |
| 用户认证 | [auth.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/middleware/auth.js) | `authenticateToken`：JWT 校验，写入 `req.user` |
| 管理员认证 | [adminAuth.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/middleware/adminAuth.js) | `verifyAdminToken`：管理员 Bearer Token 校验 |
| 输入校验 | [validation.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/middleware/validation.js) | `validateRequest`、`validateLoginRequest`、`validateConsumePointsRequest`、`sqlInjectionProtection`、`sanitizeObject` |
| 错误处理 | [errorHandler.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/middleware/errorHandler.js) | `errorHandler`、`notFound` |
| 监控 | [monitoring.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/middleware/monitoring.js) | `monitoringMiddleware`、`setupMonitoringTasks` |
| 用量限制 | [usageLimiter.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/middleware/usageLimiter.js) | 接口用量限流 |

### 6.7 配置（`config/`）

- [tierConfig.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/config/tierConfig.js)：**用户等级配置单一事实来源**，定义每日/每月配额、标签、无水印下载次数（图片/视频）。
- [paymentConfig.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/config/paymentConfig.js)：支付套餐与积分换算。

---

## 7. 关键类与函数说明

### 7.1 前端

#### `getProxiedUrl(url, useOpenaiPath)` — [geminiService.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/services/geminiService.ts#L34)

将第三方 URL（如 `https://wellai.cc/v1/...`）重写为本机/生产代理路径（`/api/ph8/...`），确保 API Key 不暴露给前端。开发环境前缀 `/architect`，生产环境为 `https://api.kbitai.com.cn`。

#### `getCurrentUserId()` — [geminiService.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/services/geminiService.ts#L9)

统一用户 ID 读取入口，优先级：`user_id` > `userId` > `email` > `'guest'`。

#### `handleConsumePoints(opts)` — [App.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/App.tsx#L599)

积分扣减核心：
1. 开发者模式/官方 API 模式直接放行。
2. `__consumePointsLock` 防重放。
3. 本地余额预检 → POST `/api/user/consume`。
4. 乐观更新 UI（按 daily→bonus→purchased 顺序扣减）。
5. 再次拉取 `/api/user/quota` 同步真实余额。

#### `TIER_CONFIG` — [App.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/App.tsx#L42-L48)

前端用户等级配置（与后端 [tierConfig.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/config/tierConfig.js) 保持一致）：

```ts
free: { daily: 200, label: '免费用户' }
beta:  { daily: 200, total: 1000, label: '内测用户' }
basic: { daily: 400, label: '基础级' }
pro:   { daily: 1500, label: 'PRO 级' }
plus:  { daily: 2000, label: 'PLUS 级' }
```

#### `consumePoints(state, action)` — [userSlice.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/src/store/userSlice.ts#L64)

Redux 内同步积分扣减 reducer，按 `daily → bonus → purchased` 顺序扣减并累加 `totalConsumedPoints`。

### 7.2 后端

#### `recordUsage(data)` — [ph8TokenService.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/services/ph8TokenService.js#L33)

记录 AI 调用用量：映射 feature 类型、解析 userId、换算积分（`points = round(cost * 1000)`），自动补全用户昵称/邮箱，写入 `kbit_usage_logs`。

#### `scheduleDailyReset()` — [server.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/server.js#L319)

定时任务：每天 0:00 调用 `ph8TokenService.resetDailyUsage()`，每月 1 号额外执行 `resetMonthlyUsage()`，递归调度下一次。

#### `authenticateToken(req, res, next)` — [auth.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/middleware/auth.js#L6)

JWT 校验中间件：从 `Authorization: Bearer <token>` 解析，查库验证用户存在性，写入 `req.user`；失败则置空并放行（非强制）。

#### `verifyAdminToken` — [adminAuth.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/middleware/adminAuth.js)

管理员强制认证中间件，所有 `/api/admin/*` 接口（除登录/重置密码外）必须通过。

#### `monitorQuery(queryFn, sql, params)` — [db.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/db.js#L73)

包装查询方法，统计耗时、慢查询（>1000ms）、错误数，发射 `slowQuery` 事件。

#### `sanitizeObject(obj, key)` — [validation.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/middleware/validation.js#L15)

递归清理对象字符串字段（`validator.escape`），白名单跳过 `image/video/data/base64` 等媒体字段。

#### `PH8_MODEL_PRICING` — [ph8.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/routes/ph8.js#L36)

WellAI 平台官方定价表（元/百万 tokens），用于 PH8 响应未含费用时按 token 计算实际成本。

---

## 8. 数据流与依赖关系

### 8.1 请求代理链路

```
前端 fetch
   │
   ├─ 开发环境 → Vite proxy (vite.config.ts) → 上游
   │     /api/ph8       → https://wellai.cc/v1   (注入 PH8_GATEWAY_KEY)
   │     /api/ph8-openai→ https://wellai.cc/openai/v1
   │     /api/user /api/usage /api/analyze /api/search → https://api.kbitai.com.cn
   │
   └─ 生产环境 → Nginx 反向代理 → 后端 Express (port 3001)
         /api/* → 后端业务路由
         /api/ph8/* → ph8Routes (代理 PH8)
         /api/gateway/:key/* → gatewayRoutes (通用多网关)
```

### 8.2 积分数据流

```
用户操作（生成图/视频/对话）
   │
   ▼
前端 handleConsumePoints
   │ 1. 本地预检余额
   │ 2. __consumePointsLock 防重放
   ▼
POST /api/user/consume  (x-user-id header)
   │
   ▼
userController.consumePoints
   │ → 校验 user_tier / daily_quota / daily_used
   │ → 写入 kbit_usage_logs
   │ → 更新 kbit_users.daily_used / total_consumed
   │ → ph8TokenService.deductBalance
   ▼
返回 { success, points: { daily_balance, daily_quota, daily_used, total_balance, total_points } }
   │
   ▼
前端乐观更新 UI + 30s 轮询 /api/user/quota 校准
```

### 8.3 用户认证流

```
注册（邀请码）→ /api/invite/register → 写入 kbit_users + invite_codes
   │
   ▼
登录 → /api/auth/login → bcrypt.compare → 返回 session（前端存 localStorage 'architect-invite-session'）
   │
   ▼
后续请求 → 前端附带 x-user-id header / X-Session-Token
   │
   ▼
后端 controllers 从 req.headers['x-user-id'] 读取
管理接口 → verifyAdminToken 中间件校验 Bearer JWT
```

### 8.4 模块依赖图（核心）

```
App.tsx
 ├─ Layout ─ i18n/locales, constants
 ├─ ConversationView ─ services/geminiService, services/chatService
 ├─ VideoGenerator ─ services/videoBlobService, services/videoWatermarkService
 ├─ SettingsPanel ─ services/configService, legal/*
 └─ services/geminiService ─ config/gateway_config.json

backend/server.js
 ├─ db.js (mysql2 pool)
 ├─ routes/* (12 个路由模块)
 │    └─ services/* (ph8TokenService, geminiService, searchDispatcher, ...)
 ├─ controllers/* (5 个控制器)
 │    └─ db.js, services/mailService, services/ph8TokenService
 ├─ middleware/* (auth, adminAuth, validation, monitoring, errorHandler)
 └─ services/cacheService (redis)
```

---

## 9. 数据库设计

### 9.1 核心表（参考 [backend/database.sql](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/database.sql) 与 [database/](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/database)）

| 表名 | 用途 |
| ---- | ---- |
| `kbit_users` | 用户主表：id、email、password_hash、nickname、user_tier、total_points、total_earned、daily_quota、daily_used、daily_reset_at、tier_expires_at、last_login_at/ip |
| `invite_codes` | 邀请码：code、points_bonus、tier、max_uses、current_uses、status、expires_at、created_by |
| `kbit_usage_logs` | 用量日志：user_id、feature、model_id、prompt/completion/total_tokens、points_cost、actual_cost、status、ip_address |
| `kbit_payment_orders` | 支付订单：user_id、points、amount、status(pending/verified/rejected)、verified_by、admin_note |
| `kbit_configs` | 系统配置（key-value） |
| `beta_requests` | 内测申请 |
| `content_ids` | AI 内容标识注册表 |

### 9.2 积分字段说明

- `total_points`：累计获得的积分总额（购买+赠送+任务）。
- `total_earned`：历史获得（兼容字段）。
- `daily_quota`：每日配额（按 tier 设置）。
- `daily_used`：当日已用。
- `daily_reset_at`：每日重置日期（字符串 YYYY-MM-DD）。
- `tier_expires_at`：等级过期时间（到期自动降级为 free）。

### 9.3 数据库脚本目录

[database/](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/database) 包含大量增量迁移与修复脚本：
- `schema.sql` / `database.sql`：基础结构。
- `refactor_points_schema.sql` / `update_points_schema.sql`：积分系统重构。
- `fix_video_costs*.sql`：视频成本修正。
- `payment_orders.sql`：支付订单表。
- `add_nickname_email_to_usage.sql`：用量日志补字段。

---

## 10. 项目运行方式

### 10.1 前端本地开发

```bash
# 1. 安装依赖
cd "e:\works\Aidev\Kbitai绝对安全\kbitai_com_cn\Architect(NewUI)"
npm install

# 2. 启动开发服务器（端口 3000）
npm run dev
# 访问 http://localhost:3000/architect/

# 3. 类型检查
npm run lint      # tsc --noEmit

# 4. 构建
npm run build     # 产物输出到 dist/
npm run preview   # 本地预览构建产物
```

**Vite 配置要点**（[vite.config.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/vite.config.ts)）：
- `base: '/architect/'`：子应用路径前缀。
- `publicDir: '../public'`：Logo 等公共资源。
- 代理：`/api/ph8` → `https://wellai.cc/v1`（注入 `PH8_GATEWAY_KEY`），`/api/user` 等 → `https://api.kbitai.com.cn`。
- 自定义插件 `serve-public-dir`：开发态服务 `/public` 静态资源。
- `define`：将 `process.env.API_KEY` 置空，密钥由后端管理。
- `terser` 压缩：生产环境 `drop_console` + `drop_debugger`。

### 10.2 后端本地开发

```bash
cd backend
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写 DB/JWT/PH8/Tavily/百度/SMTP 等

# 开发模式（热重载）
npm run dev        # nodemon server.js

# 生产模式
npm start          # node server.js，监听 port 3001
```

**环境变量清单**（参考 [README.md](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/README.md#L132) §5.1）：

| 变量 | 用途 |
| ---- | ---- |
| `DB_HOST/DB_USER/DB_PASSWORD/DB_DATABASE/DB_PORT` | MySQL 连接 |
| `JWT_SECRET` | 用户/管理员 JWT 签名（启动强制校验） |
| `ENCRYPTION_KEY` | 加密密钥 |
| `PH8_API_KEY` / `PH8_GATEWAY_KEY` / `PH8_GATEWAY_URL` | PH8 视频网关 |
| `TAVILY_API_KEY` | Tavily 搜索 |
| `BAIDU_APP_ID/API_KEY/SECRET_KEY` | 百度搜索 |
| `SMTP_HOST/PORT/USER/PASS/FROM` | 邮件 |
| `PORT` | 默认 3001 |
| `TOKEN_LOG_LEVEL/CACHE_LOG_LEVEL/PH8_LOG_LEVEL` | 日志级别 |

### 10.3 测试

```bash
cd tests
npm install
npm test           # 运行 run-tests.js
```

测试覆盖（[tests/](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/tests)）：
- 单元：`ph8.test.js`、`ph8TokenService.test.js`。
- 集成：`pointsDeduction.test.js`、`videoGeneration.test.js`。

---

## 11. 部署流程

### 11.1 部署目标

- 域名：`https://www.kbitai.com.cn`
- 服务器：宝塔面板 + Nginx + MySQL（服务器名 `kbitai0302`）
- SSL 证书：`www.kbitai.com.cn`
- 进程管理：PM2（应用名 `kbitai-api`）

### 11.2 服务器路径

| 项目 | 服务器路径 |
| ---- | ---------- |
| 前端根目录 | `/www/wwwroot/kbitai.com.cn/architect` |
| 前端部署产物 | `/www/wwwroot/kbitai.com.cn/architect/dist` |
| 公共资源 | `/www/wwwroot/kbitai.com.cn/architect/public` |
| 后端部署目录 | `/www/wwwroot/api.kbitai.com.cn` |
| 后端控制器 | `/www/wwwroot/api.kbitai.com.cn/controllers` |
| 后端路由 | `/www/wwwroot/api.kbitai.com.cn/routes` |
| 后端服务 | `/www/wwwroot/api.kbitai.com.cn/services` |
| 数据库脚本 | `/www/wwwroot/api.kbitai.com.cn/database.sql` |
| Nginx 配置 | `/www/server/panel/vhost/nginx/www.kbitai.com.cn.conf` |

### 11.3 标准部署步骤

```bash
# 1. 本地构建前端
npm run build
# 删除 dist/assets/ 中无用旧文件后再上传

# 2. 上传前端产物
# dist/ → /www/wwwroot/kbitai.com.cn/architect/dist
# public/ → /www/wwwroot/kbitai.com.cn/architect/public

# 3. 上传后端代码
# backend/controllers/  → /www/wwwroot/api.kbitai.com.cn/controllers
# backend/routes/       → .../routes
# backend/services/     → .../services

# 4. 重启服务
pm2 restart kbitai-api

# 5. 重载 Nginx
nginx -s reload
```

### 11.4 Nginx 关键配置

参考 [deploy/nginx.conf](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/deploy/nginx.conf) 与 [deploy/www.kbitai.com.cn.conf](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/deploy/www.kbitai.com.cn.conf)：
- `location /public/` → `root /www/wwwroot/kbitai.com.cn/architect/public;`
- `/api/*` 反向代理到后端 3001。
- CORS 由 Nginx 统一处理，后端不再添加 CORS 头。

### 11.5 PM2 配置

参考 [backend/ecosystem.config.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/ecosystem.config.js)：
- 应用名：`kbitai-api`
- 脚本：`/www/wwwroot/api.kbitai.com.cn/server.js`
- `max_memory_restart: '1G'`，`autorestart: true`

---

## 12. API 接口清单

### 12.1 用户认证 API

| 方法 | 路径 | 中间件 | 说明 |
| ---- | ---- | ------ | ---- |
| POST | `/api/auth/login` | `validateLoginRequest` | 用户登录 |
| POST | `/api/auth/forgot-password` | - | 请求密码重置 |
| GET | `/api/auth/verify-reset-token` | - | 验证重置令牌 |
| POST | `/api/auth/reset-password` | - | 重置密码 |

### 12.2 用户业务 API

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| GET | `/api/user/info` | 获取用户信息（x-user-id header） |
| GET | `/api/user/quota` | 实时积分配额（导航栏轮询） |
| POST | `/api/user/consume` | 消耗积分（含 feature/model_id） |
| PUT | `/api/user/nickname` | 更新昵称 |

### 12.3 邀请码 API（`/api/invite`）

| 方法 | 路径 | 中间件 | 说明 |
| ---- | ---- | ------ | ---- |
| POST | `/api/invite/generate` | `verifyAdminToken` | 批量生成邀请码 |
| GET | `/api/invite/verify/:code` | - | 验证邀请码有效性 |
| POST | `/api/invite/register` | - | 邀请码注册 |

### 12.4 网关/视频/图像 API

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| * | `/api/ph8/*` | PH8 通用代理（wellai.cc/v1） |
| * | `/api/ph8/openai/v1/*` | PH8 OpenAI 兼容路径 |
| * | `/api/ph8-openai/*` | 旧版前端兼容路径 |
| * | `/api/gateway/:gatewayKey/*` | 通用多网关代理 |
| GET | `/api/ph8/user-info` | 用户 PH8 信息 |

### 12.5 内容与下载 API

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| POST/GET | `/api/content/register` | 注册内容 ID（AI 合规标识） |
| GET | `/api/content/verify/:contentId` | 验证内容 ID |
| POST | `/api/logs/download` | 下载日志 |

### 12.6 其他业务 API

| 路由前缀 | 模块 | 说明 |
| -------- | ---- | ---- |
| `/api/payment` | payment.js | 支付下单/回调/查询 |
| `/api/usage` | usage.js | 用量日志 |
| `/api/beta` | beta.js | 内测申请 |
| `/api/plan` | plan.js | 订阅套餐 |
| `/api/search` | search.js | 联网搜索 |
| `/api/analyze` | analyze.js | 图像分析 |
| `/api/upload` | upload.js | 文件上传 |
| `/api/watermark` | watermark.js | 水印 |

### 12.7 管理后台 API（`/api/admin`，除登录外均需 `verifyAdminToken`）

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| POST | `/api/admin/login` | 管理员登录（限流） |
| POST | `/api/admin/forgot-password` | 找回密码 |
| POST | `/api/admin/reset-password` | 重置密码 |
| GET | `/api/admin/users` | 用户列表 |
| GET/PUT/DELETE | `/api/admin/users/:id` | 用户详情/更新/删除 |
| GET | `/api/admin/dashboard` | 仪表盘 |
| GET | `/api/admin/logs` | 日志列表 |
| GET | `/api/admin/logs/users` | 日志用户 |
| GET/POST/PUT/DELETE | `/api/admin/configs` | 系统配置 |
| GET | `/api/admin/beta-requests` | 内测申请列表 |
| POST | `/api/admin/beta-requests/:id/approve\|reject` | 审核内测 |
| POST | `/api/admin/change-password` | 修改管理员密码 |
| POST | `/api/admin/manual-send-invite` | 手动发送邀请 |
| GET/POST | `/api/admin/payment-orders` | 支付订单查询/审核/拒绝 |
| GET | `/api/admin/db-status` | 数据库连接池状态 |
| GET | `/api/health` | 健康检查 |
| GET/POST | `/api/admin/cache-stats` / `/api/admin/cache-flush` | 缓存统计/清空 |
| GET | `/api/admin/logs/:fileName` | 读取日志内容 |

---

## 13. 核心业务流程

### 13.1 用户注册与登录

```
1. 管理员通过 /api/invite/generate 生成邀请码（绑定 tier/points_bonus）
2. 用户在前端 InviteVerify 输入邀请码 → /api/invite/verify/:code 校验
3. 用户提交注册信息 → /api/invite/register
   - bcrypt 哈希密码
   - 写入 kbit_users（user_tier、total_points 赠送积分）
   - invite_codes.current_uses++（达到 max_uses 标记 used）
4. 登录 → /api/auth/login → 返回 session（前端存 localStorage 'architect-invite-session'）
5. 前端 initApp 调用 /api/ph8/user-info 同步 tier，/api/user/quota 同步余额
```

### 13.2 视频生成流程

```
1. 用户在 VideoGenerator（动漫导演控制台）提交 prompt
2. 前端调用 /api/ph8/openai/v1/... 或 /api/ph8/... 代理到 wellai.cc
3. 后端 ph8Routes 代理请求，按 PH8_MODEL_PRICING 计算成本
4. ph8TokenService.recordUsage 记录用量并扣减余额
5. 前端轮询任务状态直到完成
6. 视频返回 → videoBlobService 管理 blob URL
7. 切换页面后 videoBlobService 检测 blob 失效，用 videoRef 从服务器恢复
```

### 13.3 积分扣减与配额重置

```
- 每次生成调用 → 前端 handleConsumePoints → 后端 userController.consumePoints
- 后端校验 daily_quota、daily_used，写入 kbit_usage_logs，更新 kbit_users
- server.js scheduleDailyReset 每天 0:00 调用 ph8TokenService.resetDailyUsage
- 每月 1 号额外 resetMonthlyUsage
- 用户等级过期 → userController.getUserInfo 检测 tier_expires_at，自动降级 free
```

### 13.4 支付充值流程

```
1. 前端选择套餐 → /api/payment 下单（alipayService/wechatPayService）
2. 支付完成回调 → 写入 kbit_payment_orders (status=pending)
3. 管理员在后台审核 → /api/admin/payment-orders/:id/verify
   - 调用 ph8TokenService.rechargeBalance(user_id, points) 充值
   - 更新订单 status=verified
4. 前端 30s 轮询 /api/user/quota 看到余额变化
```

---

## 14. 安全机制

### 14.1 认证与授权

- **用户认证**：JWT（`authenticateToken`），通过 `Authorization: Bearer` 或 `x-user-id` header。
- **管理员认证**：独立 `verifyAdminToken`，所有管理接口必须通过。
- **管理员登录限流**：15 分钟内 5 次失败锁定（IP 维度，内存 Map）。
- **密码哈希**：bcrypt 存储 `password_hash`，不存明文。
- **开发者模式**：前端密码校验使用时间恒定哈希比较，避免源码直接搜索明文。

### 14.2 输入安全

- **SQL 注入防护**：`sqlInjectionProtection` 中间件 + mysql2 参数化查询。
- **XSS 防护**：`sanitizeObject` 递归 `validator.escape`，白名单跳过 base64 媒体字段。
- **请求体限制**：`express.json({ limit: '50mb' })`。
- **校验中间件**：`validateLoginRequest`、`validateConsumePointsRequest`、`validateUserIdParam`。

### 14.3 密钥管理

- 所有第三方密钥（Gemini、PH8、百度、Tavily、SMTP）仅存后端 `.env`，不进入前端产物。
- `vite.config.ts` 显式将 `process.env.API_KEY`、`process.env.GEMINI_API_KEY` 置空。
- 前端通过 `/api/ph8`、`/api/gateway` 代理访问，密钥在 Vite proxy 或后端注入。

### 14.4 运行时保护

- **环境变量启动校验**：`criticalEnvCheck`（JWT_SECRET）、`db.js` 启动校验 DB 配置。
- **数据库监控**：连接池统计、慢查询告警、健康检查 `/api/health`。
- **错误处理**：统一 `errorHandler` + `notFound`，避免堆栈泄漏。
- **日志**：结构化日志 + 级别控制（生产默认 WARN）。
- **Redis 降级**：连接失败时降级运行，不阻断主流程。

### 14.5 内容合规

- **AI 内容标识**：`contentIdService` 为生成内容注册唯一 ID，写入元数据（piexifjs）。
- **水印服务**：`imageWatermarkService`、`videoWatermarkService` 默认打水印，按 tier 控制无水印下载次数。
- **法律文本**：[legal/privacyPolicy.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/legal/privacyPolicy.ts)、[legal/termsOfService.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/legal/termsOfService.ts)。

---

## 附录：关键文件索引

| 类别 | 文件 |
| ---- | ---- |
| 前端入口 | [index.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/index.tsx)、[App.tsx](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/App.tsx) |
| 前端配置 | [vite.config.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/vite.config.ts)、[tsconfig.json](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/tsconfig.json)、[package.json](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/package.json) |
| 类型定义 | [types.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/types.ts) |
| 常量 | [constants.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/constants.ts) |
| Redux Store | [src/store/index.ts](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/src/store/index.ts) |
| 后端入口 | [backend/server.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/server.js) |
| 数据库 | [backend/db.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/db.js)、[backend/database.sql](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/database.sql) |
| 等级配置 | [backend/config/tierConfig.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/config/tierConfig.js) |
| PM2 | [backend/ecosystem.config.js](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/backend/ecosystem.config.js) |
| 部署 | [deploy/](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/deploy)、[README.md](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/README.md) |

---

> 本 Wiki 基于代码库静态分析生成，如代码后续演进请同步更新。详细设计文档见 [.trae/documents/](file:///e:/works/Aidev/Kbitai绝对安全/kbitai_com_cn/Architect(NewUI)/.trae/documents)。
