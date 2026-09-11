---
alwaysApply: true
---
# 项目规则
本规则各条必须严格遵守，否则将导致项目失败。
## 核心要求
- **UI 保护**：严禁修改 UI 布局和组件功能
- **代码修改**：修改前必须汇报讨论，未经同意不得修改，遵循最小化原则
- **语言要求**：使用通俗易懂的语言解释技术问题
- **部署目标**：`https://www.kbitai.com.cn`，使用宝塔、MySQL（服务器名：kbitai0302）、Nginx（SSL 证书：www.kbitai.com.cn）、FFmpeg 1.0
- **代码一致性**：本地修改后指导上传，确保本地与服务器代码一致

### Logo 配置
| 类型 | 文件名 | 本地路径 | 服务器路径 | 代码引用 |
|------|--------|----------|------------|----------|
| 水印Logo | LOGOkbitwater.png | ../public/LOGOkbitwater.png | /www/wwwroot/kbitai.com.cn/aitools/architect/public/LOGOkbitwater.png | /public/LOGOkbitwater.png |
| 公司Logo | Com_Logo.png | ../public/Com_Logo.png | /www/wwwroot/kbitai.com.cn/aitools/architect/public/Com_Logo.png | /public/Com_Logo.png |
| 应用Logo | archi01.png | ../public/archi01.png | /www/wwwroot/kbitai.com.cn/aitools/architect/public/archi01.png | /public/archi01.png |
| 备案图标 | 备案图标.png | ../public/备案图标.png | /www/wwwroot/kbitai.com.cn/aitools/architect/public/备案图标.png | /public/备案图标.png |
| 用户头像 | - | 存储在localStorage | 存储在localStorage | 键名：user-architect-avatar-v120-locked |
| 公司Logo设置 | - | 存储在localStorage | 存储在localStorage | 键名：kbit-company-logo-v120-locked |


## 配置要求
- **Vite**：vite.config.ts 中 publicDir 设置为 '../public'；base 为 `/aitools/architect/`（2026-09-10 迁移）
- **Nginx**：location /public/ { root /www/wwwroot/kbitai.com.cn/aitools/architect/public; }
- **旧地址兼容**：/architect/ 已 301 永久跳转到 /aitools/architect/（见 deploy/www.kbitai.com.cn.conf）
- **SSL 证书**：api.kbitai.com.cn 已于 2026-09-11 部署专属 LiteSSL 证书（有效期至 2026-12-09），vite 代理保持 secure:true 严格校验；注意宝塔自动续签

## 开发环境
- **前端**：http://localhost:3000/aitools/architect/（局域网 IP:3000 亦可）
- **后端**：无需本地启动；dev 接口统一经 Vite 代理（/aitools/architect/api/*）转发到 api.kbitai.com.cn 与 wellai.cc（仅 /api/content 水印 beacon 指向 localhost:3002，静默失败不影响功能）
- **数据库**：MySQL，配置在 backend/.env

## API 配置
- **开发**：相对路径 /aitools/architect/api/* 经 Vite 代理转发（api.kbitai.com.cn / wellai.cc；/api/content 走 localhost:3002 本地内容服务）
- **生产**：https://api.kbitai.com.cn
- **接口**：/api/auth/login（登录）、/api/invite/register（注册）、/api/invite/verify/:code（邀请码验证）

## 技术栈
- **前端**：React 18, TypeScript, Vite
- **后端**：Node.js, Express, MySQL 5.7+
- **部署**：Nginx, PM2

## 服务器路径配置

### 本地开发路径
| 项目 | 本地路径 |
|------|----------|
| 项目根目录 | `E:\works\Aidev\Kbitai绝对安全\kbitai_com_cn\aitools\Architect` |
| 前端目录 | `E:\works\Aidev\Kbitai绝对安全\kbitai_com_cn\aitools\Architect` |
| 后端目录 | `E:\works\Aidev\Kbitai绝对安全\kbitai_com_cn\aitools\Architect\backend` |
| 公共资源 | `E:\works\Aidev\Kbitai绝对安全\kbitai_com_cn\aitools\public` |
| 数据库脚本 | `E:\works\Aidev\Kbitai绝对安全\kbitai_com_cn\aitools\Architect\database` |

### 生产服务器路径
| 项目 | 服务器路径 |
|------|----------|
| 前端根目录 | `/www/wwwroot/kbitai.com.cn/aitools/architect` |
| 前端部署 | `/www/wwwroot/kbitai.com.cn/aitools/architect`（dist 构建产物内容直接置于该目录） |
| 访问地址 | `https://www.kbitai.com.cn/aitools/architect/` |
| 后端部署 | `/www/wwwroot/api.kbitai.com.cn` |
| 后端控制器 | `/www/wwwroot/api.kbitai.com.cn/controllers` |
| 后端路由 | `/www/wwwroot/api.kbitai.com.cn/routes` |
| 后端服务 | `/www/wwwroot/api.kbitai.com.cn/services` |
| 后端配置 | `/www/wwwroot/api.kbitai.com.cn/config` |
| 数据库脚本 | `/www/wwwroot/api.kbitai.com.cn/database.sql` |
| 公共资源 | `/www/wwwroot/kbitai.com.cn/aitools/architect/public`（另确认主站 root 下 /public/ 目录） |
| Nginx 配置 | `/www/server/panel/vhost/nginx/www.kbitai.com.cn.conf` |

## 部署流程
1. 本地修改代码
2. 构建前端：npm run build（删除 dist/assets/ 中无用文件）
3. 上传文件：前端 dist/ 内容 → `/www/wwwroot/kbitai.com.cn/aitools/architect/`（index.html 与 assets/ 置于该目录根）
4. 上传文件：后端 controllers/ → `/www/wwwroot/api.kbitai.com.cn/controllers`
5. 重启服务：pm2 restart kbitai-api
6. 重载 Nginx：nginx -s reload
7. 目录迁移后首次部署：确认旧 /architect/ 的 301 跳转与新 location 生效（curl -I 验证）

## 故障排查
- **CORS 错误**：检查 Nginx 和后端 CORS 配置
- **404 错误**：检查 API 路径和 Nginx 反向代理
- **数据库错误**：检查数据库连接配置和服务状态
- **502 错误**：检查后端服务运行状态和端口配置
