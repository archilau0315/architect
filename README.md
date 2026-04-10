# 首席图像架构师 (Chief Image Architect)

### 官方系统白皮书

#### 一、 品牌愿景与核心理念
- **品牌名称**：首席图像架构师 (Chief Image Architect)
- **研发团队**：匡形无界智能科技有限公司 (Kuanform Boundless Intelligent Technology)
- **核心开发者**：刘珂 (Archilau)
- **品牌口号**：设计有形，科技无界 (Finite Form, Infinite Tech)

---

## 项目简介

首席图像架构师是一款基于 React 19 + TypeScript + Vite 构建的 AI 创意设计平台，提供多模态 AI 对话、图像生成、视频生成等核心功能。系统采用前后端分离架构，支持多网关智能路由、用户等级体系、积分计费系统等企业级功能。

## 技术栈

### 前端
- **框架**：React 19
- **语言**：TypeScript
- **构建工具**：Vite
- **状态管理**：Redux Toolkit
- **UI组件**：自定义组件库

### 后端
- **运行环境**：Node.js
- **框架**：Express
- **数据库**：MySQL
- **缓存**：Redis（可选）
- **监控**：自定义监控服务

### 部署
- **Web服务器**：Nginx
- **SSL证书**：Let's Encrypt
- **进程管理**：PM2（推荐）

---

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- MySQL >= 8.0
- Redis >= 6.0（可选，用于缓存）

### 安装步骤

#### 1. 克隆项目
```bash
git clone https://github.com/your-repo/chief-image-architect.git
cd chief-image-architect
```

#### 2. 安装前端依赖
```bash
npm install
```

#### 3. 安装后端依赖
```bash
cd backend
npm install
cd ..
```

#### 4. 配置环境变量
复制 `.env.example` 为 `.env`，并填写以下配置：

```env
# 数据库配置
DB_HOST=localhost
DB_USER=kbitai0302
DB_PASSWORD=your_password
DB_DATABASE=kbitai0302

# 服务器配置
PORT=3001

# Redis配置（可选）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 日志配置
LOG_LEVEL=INFO
LOG_DIR=./logs

# 邮件服务配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
```

#### 5. 初始化数据库
```bash
mysql -u kbitai0302 -p kbitai0302 < backend/database.sql
```

#### 6. 构建前端
```bash
npm run build
```

#### 7. 启动服务

开发模式：
```bash
# 前端开发服务器
npm run dev

# 后端服务器（新终端）
cd backend
node server.js
```

生产模式：
```bash
# 使用PM2启动（推荐）
pm2 start backend/server.js --name "kbitai-api"
```

---

## 项目结构

```
chief-image-architect/
├── src/                        # 前端源码
│   ├── components/            # React组件
│   ├── store/                 # Redux状态管理
│   ├── hooks/                 # 自定义Hooks
│   └── services/              # API服务
├── backend/                   # 后端源码
│   ├── controllers/           # 控制器
│   ├── middleware/            # 中间件
│   ├── routes/                # 路由
│   ├── services/              # 服务层
│   └── server.js              # 入口文件
├── services/                  # 前端服务
│   ├── chatService.ts         # 聊天服务
│   ├── imageService.ts        # 图像服务
│   └── geminiService.ts       # Gemini API服务
├── components/                # 前端组件
├── legal/                     # 法律文档
└── deploy/                    # 部署配置
```

---

## 核心功能

### 1. AI对话系统
- 多模态对话（文本+图像）
- 流式响应支持
- Token使用量实时监控
- 多网关智能路由

### 2. 图像生成
- 文生图、图生图
- 局部重绘（Inpainting）
- 多风格支持（建筑、产品、艺术、角色）
- 大师风格库（54位设计大师）

### 3. 视频生成
- 文本生成视频
- 视频水印处理
- 下载权限控制

### 4. 用户系统
- 多等级体系（Free/Beta/Basic/Pro/Plus）
- 积分计费系统
- 邀请码验证
- 内测申请管理

### 5. 管理后台
- 用户管理
- 模型配置
- 系统监控
- 日志查看

---

## API文档

### 用户认证
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/forgot-password` | POST | 忘记密码 |
| `/api/auth/reset-password` | POST | 重置密码 |
| `/api/user/info` | GET | 获取用户信息 |
| `/api/user/consume` | POST | 消耗积分 |

### 内容管理
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/content/register` | POST | 注册内容 |
| `/api/content/verify/:id` | GET | 验证内容 |
| `/api/logs/download` | POST | 下载日志 |

### 管理接口
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/admin/login` | POST | 管理员登录 |
| `/api/admin/users` | GET | 用户列表 |
| `/api/admin/db-status` | GET | 数据库状态 |
| `/api/admin/cache-stats` | GET | 缓存统计 |
| `/api/admin/logs` | GET | 日志文件列表 |

### 系统监控
| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/ph8/balance` | GET | 查询余额 |
| `/api/ph8/user-info` | GET | 用户信息 |

---

## 系统优化

### 已完成的优化

1. **Redux状态管理**
   - 使用Redux Toolkit管理全局状态
   - 自定义Hooks简化状态访问
   - 状态持久化到localStorage

2. **安全增强**
   - SQL注入防护
   - XSS攻击防护
   - 输入验证中间件
   - API密钥后端管理

3. **性能优化**
   - 数据库连接池监控
   - Redis缓存支持
   - 慢查询检测
   - 请求性能监控

4. **日志系统**
   - 结构化JSON日志
   - 多级别日志（DEBUG/INFO/WARN/ERROR/FATAL）
   - 自动日志轮转
   - 请求追踪日志

5. **代码组织**
   - 服务层拆分
   - 控制器模式
   - 中间件架构
   - 错误统一处理

---

## 部署指南

### Nginx配置示例

```nginx
server {
    listen 80;
    server_name www.kbitai.com.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.kbitai.com.cn;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 前端静态文件
    location / {
        root /path/to/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # 管理后台
    location /admin {
        alias /path/to/backend/admin;
        index index.php;
        try_files $uri $uri/ =404;
    }
}
```

### PM2配置

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'kbitai-api',
    script: './backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

---

## 开发指南

### 本地开发
```bash
# 启动前端开发服务器
npm run dev

# 启动后端服务器（新终端）
cd backend
node server.js
```

### 代码规范
- 使用TypeScript进行类型检查
- 遵循ESLint代码规范
- 组件使用函数式编程
- 状态管理使用Redux Toolkit

### 测试
```bash
# 运行类型检查
npm run lint

# 构建测试
npm run build
```

---

## 故障排查

### 常见问题

1. **数据库连接失败**
   - 检查MySQL服务是否运行
   - 验证数据库配置
   - 检查用户权限

2. **Redis连接失败**
   - 系统会自动降级，不影响运行
   - 检查Redis服务是否运行
   - 验证Redis配置

3. **API请求失败**
   - 检查后端服务是否运行
   - 查看日志文件
   - 验证Nginx配置

### 日志查看
```bash
# 实时查看日志
tail -f backend/logs/app-$(date +%Y-%m-%d).log

# 查看错误日志
tail -f backend/logs/error-$(date +%Y-%m-%d).log
```

---

## Change Log

- [v3.8.0 / 2026-03-19]：**内测版账户体系与邀请码验证系统**。
  - 新增邀请码验证页面：支持内测邀请码注册（KBITDEMO1、KBITAI2026、KBITTEST）。
  - 新增内测申请表单：用户可申请内测资格，模拟模式自动发放邀请码。
  - Beta 用户积分体系：注册赠送 1000 积分，每日限额 200 积分消耗。
  - 用户头像同步：支持自定义头像，全局同步更新。
  - 视频下载权限：Beta 用户视频下载按钮灰显冻结，仅 Pro/Plus 用户可用。
  - 账户体系界面优化：显示总积分、总余额、日积分、日余额及专属权益。

- [v3.7.0 / 2026-02-12]：**精准商业计费与远程别名对位引擎部署**。
  - 路由协议升级：支持 `inputPrice` 与 `outputPrice` 分段计费，实现更精准的虚拟额度结算。
  - 模型别名翻译：新增 `remoteModelId` 映射，支持不同供应商对同名模型的多样化命名。
  - 调度算法优化：基于 `(Input*0.3 + Output*0.7)` 加权成本进行全局最优路径排序。

- [v3.6.0 / 2026-02-12]：**多源路由调度与 Failover 逃生协议部署**。
  - 实现同名模型在多源 URL 间的自动负载均衡，支持 `价格优先 -> 优先级优先` 排序。
  - 注入静默失效转移逻辑，单通道故障自动重试下一节点，确保护航设计流线。

- [v3.5.0 / 2026-02-12]：**材质原子级解算协议 (Atomic Material Protocol) 部署**。

- [v2.0.0 / 2026-02-12]：**商业版里程碑：智能分发网关与 Failover 架构**。

---

## 技术支持

- **项目维护**：KBITAI 团队
- **部署服务器**：kbitai0302
- **官方网站**：https://www.kbitai.com.cn
- **联系邮箱**：support@kbitai.com.cn

---

## 许可证

本项目采用商业许可证，未经授权不得用于商业用途。

**版权所有 © 2026 匡形无界智能科技有限公司**
