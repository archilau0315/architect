# GitHub Copilot Workspace Instructions

## 目标

这个仓库是一个前端 + 后端全栈项目，包含 React/Vite 前端和 Express 后端服务。该文件用于指导 AI 代理快速理解项目结构、工作重点和常见约定。

## 项目概览

- 根目录为前端子应用，使用 `React 19`、`Vite`、`TypeScript`、`Tailwind CSS`。
- `backend/` 目录为 Node.js + Express API 服务，连接 MySQL，并包含管理员后台静态页面。
- `database/` 和 `deploy/` 目录包含数据库脚本与部署配置。
- `tests/` 下有前端测试文件，但根 `package.json` 没有完整测试脚本。

## 关键目录

- `App.tsx`, `index.tsx`, `vite.config.ts`：前端入口与构建配置。
- `components/`：前端界面组件。
- `services/`：前端业务服务封装。
- `backend/server.js`：后端启动入口。
- `backend/routes/`：Express 路由。
- `backend/controllers/`：业务控制器。
- `backend/services/`：后端服务层逻辑。
- `backend/middleware/`：请求验证、日志、监控、中间件。
- `backend/admin/`：管理后台静态页面。

## 运行与构建

- 前端
  - `npm install`
  - `npm run dev`
  - `npm run build`
  - `npm run preview`

- 后端
  - `cd backend`
  - `npm install`
  - `npm run dev`
  - `npm start`

## 代码编辑建议

- 优先修改 `backend/*` 里的源代码，不要直接编辑 `dist/` 或 `node_modules/`。
- 前端逻辑通常分布在 `App.tsx`、`components/` 和 `services/`。
- 后端实现逻辑分布在 `backend/routes/`、`backend/controllers/`、`backend/services/`。
- 管理后台 UI 是静态 HTML/JS 页面，位于 `backend/admin/`。
- 这个项目包含大量中文注释、变量和日志信息，维护时请保留现有风格。

## 重点关注

- PH8 视频/图像生成代理路径在 `backend/routes/ph8.js`。
- 用户积分、消耗、余额逻辑集中在 `backend/services/ph8TokenService.js`。
- 后端用户与管理接口在 `backend/controllers/adminController.js` 和 `backend/controllers/userController.js`。
- 前端与后端之间存在邀请 session、quota 查询、token 监控等同步逻辑。

## 不要做的事

- 不要修改 `dist/` 里的构建产物。
- 不要替换掉整个 `backend/server.js`，除非必要。
- 不要修改 `package-lock.json` 以外的依赖清单文件，除非修复依赖问题。
- 避免在没有测试或确认的情况下更改数据库列名。

## 进一步行动建议

如果你需要继续改进本仓库，可以考虑：
1. 补齐管理后台统计接口的实际消耗字段显示。
2. 优化 `ph8` 代理中的成本提取与日志记录逻辑。
3. 统一前端 `usage` / `quota` 同步接口的返回字段。

## 示例提示

- “查看并修复后台用户消费统计的 SQL 查询”
- “帮我确认 `backend/routes/ph8.js` 中实际成本提取逻辑是否覆盖 PH8 返回格式”
- “说明这个仓库前端如何获取用户等级和积分信息”
