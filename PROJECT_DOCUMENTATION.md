# KBITAI 项目文档

## 1. 项目概述

KBITAI 是一个基于 React 19 + TypeScript + Vite 的前端应用，结合 Node.js + Express 后端，提供 AI 相关的服务和功能。

### 1.1 技术栈

- **前端**: React 19, TypeScript, Vite, Redux Toolkit
- **后端**: Node.js, Express, MySQL
- **数据库**: MySQL (kbitai0302)
- **服务器**: Nginx (带 SSL 证书)
- **AI 能力**: Gemini API
- **部署**: 宝塔面板

## 2. 项目架构

### 2.1 前端架构

```
/src
  /components     # 组件
  /services       # 服务
  /store          # Redux 状态管理
  /hooks          # 自定义 Hook
  /utils          # 工具函数
  App.tsx         # 应用入口
  main.tsx        # 主文件
```

### 2.2 后端架构

```
/bankend
  /controllers    # 控制器
  /middleware     # 中间件
  /routes         # 路由
  /services       # 服务
  server.js       # 服务器入口
  db.js           # 数据库连接
  database.sql    # 数据库结构
```

## 3. 核心功能

### 3.1 前端功能

- AI 对话界面
- 图像处理功能
- 用户认证和授权
- 积分管理
- 模型选择和配置

### 3.2 后端功能

- 用户管理
- 积分系统
- 内容注册和验证
- 下载日志记录
- 监控系统
- API 网关

## 4. API 文档

### 4.1 用户认证 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/forgot-password` | POST | 请求密码重置 |
| `/api/auth/verify-reset-token` | GET | 验证重置令牌 |
| `/api/auth/reset-password` | POST | 重置密码 |
| `/api/user/info` | GET | 获取用户信息 |
| `/api/user/consume` | POST | 消耗积分 |

### 4.2 内容管理 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/content/register` | POST | 注册内容 |
| `/api/content/verify/:contentId` | GET | 验证内容 |
| `/api/logs/download` | POST | 记录下载日志 |

### 4.3 管理后台 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/admin/login` | POST | 管理员登录 |
| `/api/admin/users` | GET | 获取用户列表 |

### 4.4 其他 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/invite` | 多个 | 邀请码相关 |
| `/api/watermark` | 多个 | 水印相关 |
| `/api/usage` | 多个 | 用量统计 |
| `/api/beta` | 多个 | 内测相关 |
| `/api/plan` | 多个 | 计划相关 |
| `/api/ph8` | 多个 | PH8 相关 |
| `/api/gateway/:gatewayKey/*` | 多个 | API 网关 |

## 5. 数据库结构

### 5.1 核心表结构

- **users**: 用户信息
- **invite_codes**: 邀请码
- **beta_applications**: 内测申请
- **password_reset_tokens**: 密码重置令牌
- **point_logs**: 积分日志
- **download_logs**: 下载日志
- **content_registry**: 内容注册
- **admins**: 管理员
- **token_usage**: Token 用量统计
- **user_quotas**: 用户配额
- **rate_limit_logs**: 限流日志
- **tier_limits**: 等级配额配置
- **plans**: 计划表
- **monitoring_logs**: 监控日志
- **system_metrics**: 系统指标

## 6. 部署配置

### 6.1 Nginx 配置

```nginx
server {
    listen 80;
    server_name www.kbitai.com.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.kbitai.com.cn;
    
    ssl_certificate /path/to/ssl/certificate;
    ssl_certificate_key /path/to/ssl/private/key;
    
    # CORS 配置
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
    add_header Access-Control-Allow-Headers 'Content-Type, Authorization';
    add_header Access-Control-Max-Age 86400;
    
    location / {
        root /path/to/frontend/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /admin {
        alias /path/to/bankend/admin;
        index index.php;
        try_files $uri $uri/ =404;
        
        location ~ \.php$ {
            include fastcgi_params;
            fastcgi_pass unix:/run/php/php7.4-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $request_filename;
        }
    }
}
```

### 6.2 环境变量配置

```env
# .env 文件

# 数据库配置
DB_HOST=localhost
DB_USER=kbitai0302
DB_PASSWORD=kbitai2026
DB_DATABASE=kbitai0302

# 服务器配置
PORT=3001

# 邮件服务配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password

# AI API 配置
GEMINI_API_KEY=your_api_key
```

## 7. 监控系统

### 7.1 监控指标

- API 调用次数和响应时间
- 系统资源使用情况（内存、CPU）
- 错误率和类型
- 系统运行时间

### 7.2 监控数据存储

监控数据存储在以下表中：
- **monitoring_logs**: 记录 API 调用情况
- **system_metrics**: 记录系统资源使用情况

## 8. 安全措施

- 使用 HTTPS 加密传输
- 密码哈希存储
- CORS 配置
- 错误处理和日志记录
- 敏感信息保护

## 9. 开发和部署流程

### 9.1 开发流程

1. 克隆代码库
2. 安装依赖：`npm install`
3. 启动开发服务器：`npm run dev`
4. 后端启动：`node bankend/server.js`

### 9.2 部署流程

1. 构建前端：`npm run build`
2. 将构建产物上传到服务器
3. 配置 Nginx 服务器
4. 启动后端服务
5. 导入数据库结构：`mysql -u kbitai0302 -p kbitai0302 < bankend/database.sql`

## 10. 故障排查

### 10.1 常见问题

- **API 响应缓慢**: 检查数据库查询性能和系统资源使用情况
- **登录失败**: 检查用户凭证和数据库连接
- **文件上传失败**: 检查文件大小限制和服务器存储空间
- **监控数据缺失**: 检查数据库连接和监控服务运行状态

### 10.2 日志查看

- 前端日志：浏览器开发者工具控制台
- 后端日志：服务器端日志文件
- 数据库日志：MySQL 错误日志
- 监控日志：数据库中的 monitoring_logs 表

## 11. 未来计划

- 迁移 PHP 管理后台到 Node.js
- 增强监控系统功能
- 添加更多 AI 模型支持
- 优化用户体验
- 提高系统安全性

## 12. 联系信息

- 项目维护者：KBITAI 团队
- 部署服务器：kbitai0302
- 域名：https://www.kbitai.com.cn
