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
| 水印Logo | LOGOkbitwater.png | ../public/LOGOkbitwater.png | /www/wwwroot/kbitai.com.cn/architect/public/LOGOkbitwater.png | /public/LOGOkbitwater.png |
| 公司Logo | Com_Logo.png | ../public/Com_Logo.png | /www/wwwroot/kbitai.com.cn/architect/public/Com_Logo.png | /public/Com_Logo.png |
| 应用Logo | archi01.png | ../public/archi01.png | /www/wwwroot/kbitai.com.cn/architect/public/archi01.png | /public/archi01.png |
| 备案图标 | 备案图标.png | ../public/备案图标.png | /www/wwwroot/kbitai.com.cn/architect/public/备案图标.png | /public/备案图标.png |
| 用户头像 | - | 存储在localStorage | 存储在localStorage | 键名：user-architect-avatar-v120-locked |
| 公司Logo设置 | - | 存储在localStorage | 存储在localStorage | 键名：kbit-company-logo-v120-locked |


## 配置要求
- **Vite**：vite.config.ts 中 publicDir 设置为 '../public'
- **Nginx**：location /public/ { root /www/wwwroot/kbitai.com.cn/architect/public; }

## 开发环境
- **前端**：http://localhost:3000
- **后端**：http://localhost:3001
- **数据库**：MySQL，配置在 backend/.env

## API 配置
- **开发**：http://localhost:3001
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
| 项目根目录 | `g:\Archilau\Kbitai绝对安全\Kbitai_com_cn\Architect(NewUI)` |
| 前端目录 | `g:\Archilau\Kbitai绝对安全\Kbitai_com_cn\Architect(NewUI)` |
| 后端目录 | `g:\Archilau\Kbitai绝对安全\Kbitai_com_cn\Architect(NewUI)\backend` |
| 公共资源 | `g:\Archilau\Kbitai绝对安全\Kbitai_com_cn\Architect(NewUI)\public` |
| 数据库脚本 | `g:\Archilau\Kbitai绝对安全\Kbitai_com_cn\Architect(NewUI)\database` |

### 生产服务器路径
| 项目 | 服务器路径 |
|------|----------|
| 前端根目录 | `/www/wwwroot/kbitai.com.cn/architect` |
| 前端部署 | `/www/wwwroot/kbitai.com.cn/architect/dist` |
| 后端部署 | `/www/wwwroot/api.kbitai.com.cn` |
| 后端控制器 | `/www/wwwroot/api.kbitai.com.cn/controllers` |
| 后端路由 | `/www/wwwroot/api.kbitai.com.cn/routes` |
| 后端服务 | `/www/wwwroot/api.kbitai.com.cn/services` |
| 后端配置 | `/www/wwwroot/api.kbitai.com.cn/config` |
| 数据库脚本 | `/www/wwwroot/api.kbitai.com.cn/database.sql` |
| 公共资源 | `/www/wwwroot/kbitai.com.cn/architect/public` |
| Nginx 配置 | `/www/server/panel/vhost/nginx/www.kbitai.com.cn.conf` |

## 部署流程
1. 本地修改代码
2. 构建前端：npm run build（删除 dist/assets/ 中无用文件）
3. 上传文件：前端 dist/ → `/www/wwwroot/kbitai.com.cn/architect/dist`
4. 上传文件：后端 controllers/ → `/www/wwwroot/api.kbitai.com.cn/controllers`
5. 重启服务：pm2 restart kbitai-api
6. 重载 Nginx：nginx -s reload

## 故障排查
- **CORS 错误**：检查 Nginx 和后端 CORS 配置
- **404 错误**：检查 API 路径和 Nginx 反向代理
- **数据库错误**：检查数据库连接配置和服务状态
- **502 错误**：检查后端服务运行状态和端口配置
