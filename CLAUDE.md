# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI 创意设计平台"首席图像架构师" v4.0.0 NewUI 版，支持多模态 AI 对话、图像生成、视频生成，集成多 AI 网关路由（Gemini、ph8.co），含完整用户积分计费体系。

## 常用命令

```bash
# 前端开发
npm run dev          # 启动开发服务器 (port 3000)
npm run build        # Vite 构建，输出到 dist/
npm run lint         # TypeScript 类型检查 (tsc --noEmit)
npm run preview      # 预览构建产物

# 后端
cd backend && node server.js   # 启动后端 (port 3001)
```

## 架构概览

**前端**（根目录）：React 19 + TypeScript + Vite，部署于 `/architect/` 路径。

- [components/](components/) — 根级 React 组件（`Layout.tsx`、`ConversationView.tsx` 等核心 UI）
- [services/](services/) — 前端服务层：`chatService`（对话）、`imageService`（图像）、`geminiService`（Gemini AI）
- [store/](store/) — Redux Toolkit 状态管理
- [hooks/](hooks/) — 自定义 Hooks
- [i18n/](i18n/) — 国际化
- [config/](config/) — 运行时配置（`gateway_config.json` 等）
- [types.ts](types.ts) — 全局类型定义
- [constants.ts](constants.ts) — 全局常量

**后端**（[backend/](backend/)）：Node.js + Express + MySQL 8.0，独立子项目。

- [backend/routes/](backend/routes/) — API 路由
- [backend/controllers/](backend/controllers/) — 控制器
- [backend/services/](backend/services/) — 业务逻辑层
- [backend/middleware/](backend/middleware/) — 认证、验证、安全中间件
- [backend/db.js](backend/db.js) — MySQL 连接
- [backend/database.sql](backend/database.sql) — 数据库初始化脚本

## API 代理路由（vite.config.ts）

| 路径前缀                                             | 目标                            |
| ------------------------------------------------ | ----------------------------- |
| `/architect/api/auth`, `/api/user`, `/api/usage` | `https://api.kbitai.com.cn`   |
| `/api/content`, `/api/ph8/user-info`             | `http://localhost:3002`       |
| `/api/ph8`                                       | `https://ph8.co/v1`（外部 AI 网关） |

## 关键约定

- 前端通过 Vite 代理访问后端，开发时无需跨域配置
- AI 调用走 `services/` 层，不直接在组件中调用 SDK
- 积分消耗逻辑在后端 `services/` 中处理，前端只做展示
  ### Logo文件路径
  - 所有Logo文件存放在 `//kbitai_com_cn/public/` 目录下，包括：
    - `archi01.png` - AI头像Logo
    - `Com_Logo.png` - 公司Logo
    - `LOGOkbitwater.png` - 水印Logo
    - `备案图标.png` - 备案图标
  ### Vite配置
  - `vite.config.ts` 中 `publicDir` 设置为 `'../public'`，指向上级目录的公共资源文件夹
  - 删除了项目内的 `public/` 文件夹，避免重复
  ### 水印设置规范
  - **颜色**：所有水印必须为白色（#FFFFFF）
  - **透明度**：所有水印透明度必须为50%（globalAlpha = 0.5）
  - **水印文件**：统一使用 `LOGOkbitwater.png`
  - **路径格式**：统一使用 `/LOGOkbitwater.png`（绝对路径）### Logo文件路径
    \- 所有Logo文件存放在 \`//kbitai\_com\_cn/public/\` 目录下，包括：
    &#x20; \- \`archi01.png\` - AI头像Logo
    &#x20; \- \`Com\_Logo.png\` - 公司Logo
    &#x20; \- \`LOGOkbitwater.png\` - 水印Logo
    &#x20; \- \`备案图标.png\` - 备案图标

    \### Vite配置
    \- \`vite.config.ts\` 中 \`publicDir\` 设置为 \`'../public'\`，指向上级目录的公共资源文件夹
    \- 删除了项目内的 \`public/\` 文件夹，避免重复

    \### 水印设置规范
    \- \*\*颜色\*\*：所有水印必须为白色（#FFFFFF）
    \- \*\*透明度\*\*：所有水印透明度必须为50%（globalAlpha = 0.5）
    \- \*\*水印文件\*\*：统一使用 \`LOGOkbitwater.png\`
    \- \*\*路径格式\*\*：统一使用 \`/LOGOkbitwater.png\`（绝对路径）


