# 部署手册 · Deployment Guide

> 本手册基于本项目实际生产架构整理，已对域名、服务器绝对路径、账号密码等做脱敏处理，
> 文中以 `example.com` / 通用路径示意。实际部署时请替换为您自己的域名和路径。
>
> 首页文档：[中文](../README.md) ｜ [English](../README.en.md)

## 一、部署概述

本应用采用**前后端分离 + Nginx 共域代理**架构：

| 角色 | 部署方式 | 访问（示例） |
| --- | --- | --- |
| 前端 SPA | Nginx 子路径发布纯静态文件 | `https://www.example.com/aitools/architect/` |
| 后端 API | PM2 守护的 Express，独立子域或同域反代 | `https://api.example.com` |
| 管理后台 | 同域另一个静态子应用 | `https://www.example.com/admin/` |

> 🔒 公开仓库不含任何真实域名、默认账号、密钥。首次部署后请立即修改默认密码。

***

## 二、系统要求

### 2.1 服务器环境

- **操作系统**：Linux（CentOS 7+ / Ubuntu 18.04+）
- **Web 服务器**：Nginx 1.20+
- **Node.js**：18+（推荐 20 LTS）
- **数据库**：MySQL 5.7+ / 8.0+
- **进程守护**：PM2（latest）
- **内存**：最低 2GB，推荐 4GB+
- **磁盘**：最低 20GB

### 2.2 关键组件

- **FFmpeg 1.0**：如需服务端视频处理；本项目视频水印主要在浏览器端
  （FFmpeg.wasm）完成，对服务器 FFmpeg 依赖较低
- **SSL 证书**：Let's Encrypt / TrustAsia（支持泛域名或分别签发）
- **面板（可选）**：宝塔面板，用于站点、证书、数据库管理

***

## 三、目录结构（通用示意）

### 3.1 前端部署目录

```
/www/wwwroot/example.com/aitools/architect/
├── index.html              # 前端入口
├── assets/                 # 构建产物（JS / CSS，带内容哈希）
│   ├── index-*.js
│   ├── index-*.css
│   └── ...
└── public/                 # 公共资源（Logo、支付码等，可选）
```

### 3.2 对应仓库结构

```
Architect/
├── dist/                   # npm run build 产物，部署时上传其“内容”
├── backend/                # 后端源码（对应服务器上的 api 站点目录）
│   ├── server.js
│   ├── routes/
│   ├── services/
│   ├── controllers/
│   ├── middleware/
│   └── ecosystem.config.js
├── database/               # 数据库脚本
└── deploy/                 # Nginx 配置参考（本仓库自带）
```

### 3.3 后端目录

```
/www/wwwroot/api.example.com/
├── server.js
├── routes/
│   ├── ph8.js              # 视频 API 网关代理
│   ├── usage.js            # 用量统计
│   ├── payment.js          # 支付
│   └── ...
├── services/
├── controllers/
├── middleware/
├── config/
└── database.sql
```

***

## 四、部署步骤

### 4.1 前端构建与上传

```bash
# 本地（项目根目录）
npm install
npm run build
```

将 `dist/` **目录里的内容**（不是 dist 文件夹本身）上传到前端部署目录：

- `dist/index.html` → 部署目录根
- `dist/assets/` → 部署目录根下 `assets/`
- `dist/` 下其余静态资源（Logo、支付码图片等）一并上传

> 上传新版本前，建议先删除旧的哈希资源文件，避免残留；Vite 每次构建默认清空本地
> `dist/`（`emptyOutDir`），但不会自动清理服务器旧文件。

### 4.2 后端部署

```bash
cd /www/wwwroot/api.example.com
npm install --production
cp .env.example .env       # 填写真实配置（见第六节）
mysql -u root -p < database.sql
```

### 4.3 启动 / 更新服务

```bash
# 首次启动
pm2 start ecosystem.config.js

# 日常更新代码后
pm2 restart kbitai-api

# 查看日志排错
pm2 logs kbitai-api --lines 50

# 设置开机自启
pm2 save && pm2 startup
```

***

## 五、Nginx 配置要点

完整参考配置见仓库 [`deploy/www.kbitai.com.cn.conf`](../deploy/www.kbitai.com.cn.conf)
（文件名为历史命名，内容为通用结构）。核心要点：

1. **前端 location**：使用 `alias` 指向部署目录，`try_files` 回退 `index.html` 支持
   SPA 深链刷新；子路径必须与 Vite 的 `base` 一致（`/aitools/architect/`）
2. **API location**：`/api/` 反代到 Express（默认 3001 端口），配置 CORS 响应头、
   `client_max_body_size 50M`、视频接口 600s 长超时
3. **SSL**：前端域与 API 子域分别配置证书；子域必须部署**包含该子域名**的证书，
   否则浏览器报 `ERR_CERT_COMMON_NAME_INVALID`
4. **旧路径 301**：如发生过目录迁移，旧路径用 `return 301` / `rewrite ... permanent`
   做永久跳转，兼容历史外链

修改配置后：

```bash
nginx -t                       # 语法检查必须先通过
/etc/init.d/nginx reload       # 宝塔环境推荐（避免 nginx -s reload 的 PID 过期问题）
```

***

## 六、环境变量（.env）

```env
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_database
DB_USERNAME=your_db_user
DB_PASSWORD=your_strong_password

# JWT 与加密
JWT_SECRET=replace_with_a_long_random_string
ENCRYPTION_KEY=replace_with_32_characters_xx

# 调试
APP_DEBUG=false

# 视频生成网关
PH8_API_KEY=your_video_api_key
PH8_GATEWAY_KEY=your_video_gateway_key
PH8_GATEWAY_URL=https://gateway.example.com

# 海外联网搜索
TAVILY_API_KEY=your_tavily_key

# 百度图像搜索
BAIDU_APP_ID=your_baidu_app_id
BAIDU_API_KEY=your_baidu_api_key
BAIDU_SECRET_KEY=your_baidu_secret_key
```

> 密钥建议用 `openssl rand -hex 32` 生成。`.env` 必须加入 `.gitignore`，严禁入库。

***

## 七、API 概览

### 7.1 业务接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/invite/register` | 邀请码注册 |
| GET | `/api/invite/verify/:code` | 校验邀请码 |
| POST | `/api/ph8/proxy` | 视频网关代理 |
| GET | `/api/ph8/user-info` | 用户等级信息 |
| GET | `/api/usage/logs` | 用量日志 |
| GET | `/api/user/quota` | 余额 / 配额 |

### 7.2 管理接口（需管理员鉴权）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/users` | 用户列表 |
| GET | `/api/admin/usage` | 使用统计 |
| POST | `/api/admin/reset-password` | 重置密码 |

***

## 八、视频功能机制

### 8.1 生成流程

1. 用户在「动漫导演控制台」提交生成请求
2. 后端经视频网关创建任务
3. 前端轮询任务状态直至完成
4. 视频地址本地持久化，切换 / 刷新后自动从服务端恢复

### 8.2 视频水印

- 水印在浏览器内通过 **FFmpeg.wasm + Web Worker** 完成，不占用服务端算力
- 核心 wasm 约 30MB，首次进入视频功能时按需加载，之后走浏览器缓存

### 8.3 计费参考（以实际网关费率为准）

- 基础费率：100,000 tokens ≈ ¥0.42
- 单次视频生成约消耗 117 积分（随模型费率浮动）

***

## 九、常见问题

### 9.1 502 Bad Gateway

```bash
pm2 list                 # 确认 kbitai-api 在线
pm2 logs kbitai-api      # 查看后端报错
ss -tlnp | grep 3001     # 确认端口监听
```

### 9.2 证书错误 `ERR_CERT_COMMON_NAME_INVALID`

API 子域返回了其他站点的证书。在面板中为该子域**单独申请并部署**包含其子域名的
证书，部署后确认 Nginx 已重载。

### 9.3 CORS 错误

- 检查 Nginx `/api/` 的 `Access-Control-Allow-*` 响应头
- 检查后端自身的 CORS 中间件，避免重复或冲突
- 开发环境应使用 Vite 代理（3000 端口），不要让浏览器直连后端

### 9.4 积分显示为「-」

后端不可用、数据库连接失败或计费服务异常。依次检查 PM2 日志、数据库连接、
网关凭证。

### 9.5 视频生成失败

- 浏览器控制台查看前端报错
- 后端 `pm2 logs` 查看网关响应
- 确认 Nginx 反代超时 ≥ 600s、上传限制 ≥ 50M

### 9.6 `nginx -s reload` 报 kill failed

PID 文件过期（主进程被其他方式重启过）。改用：

```bash
/etc/init.d/nginx reload
```

***

## 十、上线检查清单

- [ ] 默认管理员密码已修改为强密码
- [ ] `.env` 未入库，密钥均为随机值且与开发环境不同
- [ ] 前端 `base` 与 Nginx 子路径一致，深链刷新返回 200
- [ ] 前端域、API 子域证书均有效且覆盖正确域名
- [ ] `nginx -t` 通过，旧外链 301 正常
- [ ] PM2 已配置开机自启
- [ ] 数据库定期备份已配置
- [ ] 静态资源缓存与版本哈希生效，更新后用户无旧缓存问题
