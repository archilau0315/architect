# 首席图像架构师 - 子应用部署文档

> **最后更新**: 2026-05-05
> **版本**: v1.2.0

## 一、部署概述

本应用为 **www.kbitai.com.cn** 的子应用，部署路径如下：

| 访问地址 | 说明 |
|----------|------|
| https://www.kbitai.com.cn/architect/ | 前端应用 |
| https://api.kbitai.com.cn | 后端API（独立域名） |
| https://www.kbitai.com.cn/admin/ | 管理后台 |

---

## 二、系统要求

### 服务器环境
- **操作系统**: Linux (CentOS 7+ / Ubuntu 18.04+)
- **Web服务器**: Nginx 1.20+
- **Node.js**: 18+
- **数据库**: MySQL 5.7+ / 8.0+
- **内存**: 最低 2GB，推荐 4GB+
- **磁盘**: 最低 20GB

### PHP 扩展要求
- PDO
- PDO_MySQL
- JSON
- MBString
- OpenSSL
- cURL

---

## 三、目录结构

### 3.1 前端目录（/www/wwwroot/kbitai.com.cn/architect/）
```
/www/wwwroot/kbitai.com.cn/architect/
├── index.html              # 前端入口
├── assets/                 # 前端资源（JS/CSS）
│   ├── index-*.js         # 主JS文件
│   ├── index-*.css        # 主CSS文件
│   └── ...
└── public/                 # 公共资源（Logo等）
    ├── LOGOkbitwater.png
    ├── Com_Logo.png
    └── ...
```

### 3.2 后端目录（/www/wwwroot/api.kbitai.com.cn/）
```
/www/wwwroot/api.kbitai.com.cn/
├── server.js              # 服务入口
├── routes/                # 路由
│   ├── ph8.js            # PH8视频API代理
│   ├── usage.js          # 用量统计
│   └── ...
├── services/             # 服务层
│   ├── ph8TokenService.js  # 积分服务
│   └── ...
├── controllers/          # 控制器
├── middleware/           # 中间件
├── config/              # 配置
└── database.sql         # 数据库脚本
```

---

## 四、部署步骤

### 4.1 前端部署

```bash
# 1. 本地构建
cd Architect\(NewUI\)
npm install
npm run build

# 2. 上传构建产物到服务器
# dist/ → /www/wwwroot/kbitai.com.cn/architect/
# 注意：上传前删除旧的 .js/.css 文件，只保留新文件

# 3. 公共资源
# public/ → /www/wwwroot/kbitai.com.cn/architect/public/
```

### 4.2 后端部署

```bash
# 1. 上传后端代码到服务器
# backend/ → /www/wwwroot/api.kbitai.com.cn/

# 2. 安装依赖
cd /www/wwwroot/api.kbitai.com.cn
npm install --production

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填写正确的配置

# 4. 导入数据库
mysql -u root -p kbitai0302 < database.sql
```

### 4.3 启动服务

```bash
# 使用 PM2 启动
pm2 start ecosystem.config.js --name kbitai-api

# 重启服务
pm2 restart kbitai-api

# 查看日志
pm2 logs kbitai-api --lines 50
```

---

## 五、环境配置

### 5.1 后端环境变量 (.env)
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=kbitai0302
DB_USERNAME=root
DB_PASSWORD=your_password

# JWT密钥
JWT_SECRET=your-random-jwt-secret-key

# 加密密钥
ENCRYPTION_KEY=your-32-char-encryption-key

# 调试模式
APP_DEBUG=false

# PH8 网关配置（视频生成API）
PH8_API_KEY=your_ph8_api_key
PH8_GATEWAY_KEY=your_ph8_gateway_key
PH8_GATEWAY_URL=https://ph8.co

# Tavily Search API（海外联网搜索）
TAVILY_API_KEY=your_tavily_api_key

# 百度图像搜索 API
BAIDU_APP_ID=your_baidu_app_id
BAIDU_API_KEY=your_baidu_api_key
BAIDU_SECRET_KEY=your_baidu_secret_key
```

---

## 六、API 接口

### 6.1 后端API（api.kbitai.com.cn）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 用户登录 |
| POST | /api/invite/register | 注册 |
| GET | /api/invite/verify/:code | 验证邀请码 |
| POST | /api/ph8/proxy | PH8视频API代理 |
| GET | /api/usage/logs | 用量日志 |
| GET | /api/ph8/user-info | 用户PH8信息 |

### 6.2 管理后台API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/users | 用户列表 |
| GET | /api/admin/usage | 使用统计 |
| POST | /api/admin/reset-password | 重置密码 |

---

## 七、视频功能说明

### 7.1 视频生成流程

1. 用户在"动漫导演控制台"生成视频
2. 后端通过PH8 API创建视频任务
3. 前端轮询任务状态直到完成
4. 视频URL保存到localStorage
5. 切换页面后自动从服务器恢复

### 7.2 视频URL恢复机制

当blob URL失效时，系统会自动：
1. 检测到blob URL已失效
2. 使用保存的videoRef从服务器重新获取
3. 恢复视频显示

### 7.3 积分计算规则

PH8视频费率标准：
- 基础费率：100,000 tokens = ¥0.42
- 单价：¥0.0000042 / token
- 标准积分：约117积分/次视频生成

---

## 八、常见问题

### 8.1 502 Bad Gateway
- 检查后端服务是否运行：`pm2 list`
- 重启服务：`pm2 restart kbitai-api`

### 8.2 视频生成失败
- 检查浏览器控制台错误
- 检查后端日志：`pm2 logs kbitai-api`

### 8.3 积分显示为-
- 后端服务未正常运行
- 数据库连接失败
- 积分计算逻辑异常

### 8.4 CORS 错误
- 检查Nginx配置
- 检查后端CORS设置
- 确认API地址配置正确

---

## 九、访问地址汇总

| 功能 | 地址 |
|------|------|
| 前端应用 | https://www.kbitai.com.cn/architect/ |
| 管理后台 | https://www.kbitai.com.cn/admin/ |
| 后端API | https://api.kbitai.com.cn |
| PH8代理 | https://api.kbitai.com.cn/api/ph8 |

---

## 十、默认账号

| 类型 | 账号 | 密码 |
|------|------|------|
| 管理员 | admin | admin123 |

**⚠️ 请在首次登录后立即修改密码！**

---

## 十一、联系支持

- **公司**: 天津匡形无界智能科技有限公司
- **域名**: www.kbitai.com.cn
- **邮箱**: kbit_ai@126.com
