# 首席图像架构师 - 子应用部署文档

## 一、部署概述

本应用为 **www.kbitai.com.cn** 的子应用，部署路径如下：

| 访问地址 | 说明 |
|----------|------|
| https://www.kbitai.com.cn/architect/ | 前端应用 |
| https://www.kbitai.com.cn/architect/backend/ | 后端API |
| https://www.kbitai.com.cn/architect/admin/ | 管理后台 |

---

## 二、系统要求

### 服务器环境
- **操作系统**: Linux (CentOS 7+ / Ubuntu 18.04+)
- **Web服务器**: Nginx 1.20+
- **PHP**: 8.2+
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

## 三、宝塔面板部署

### 3.1 目录结构
```
/www/wwwroot/kbitai.com.cn/
├── index.html              # 主站首页
├── architect/              # 首席图像架构师子应用
│   ├── index.html          # 前端入口
│   ├── assets/             # 前端资源
│   ├── backend/            # 后端服务
│   │   ├── index.php
│   │   ├── config/
│   │   ├── includes/
│   │   ├── models/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── storage/
│   └── admin/              # 管理后台
│       └── index.html
└── ...
```

### 3.2 上传代码
将项目文件上传到子应用目录：
```bash
# 创建目录
mkdir -p /www/wwwroot/kbitai.com.cn/architect

# 上传文件
# 前端构建产物 → /www/wwwroot/kbitai.com.cn/architect/
# 后端代码 → /www/wwwroot/kbitai.com.cn/architect/backend/
# 管理后台 → /www/wwwroot/kbitai.com.cn/architect/admin/
```

### 3.3 导入数据库
1. 打开 phpMyAdmin
2. 选择或创建数据库 `kbit_architect`
3. 导入 `database/schema.sql`

### 3.4 配置 Nginx
将 `deploy/nginx.conf` 内容合并到主站 Nginx 配置中：
```
/www/server/panel/vhost/nginx/www.kbitai.com.cn.conf
```

### 3.5 设置权限
```bash
cd /www/wwwroot/kbitai.com.cn/architect
chmod -R 755 backend/storage
chown -R www:www backend/storage
```

---

## 四、前端构建配置

### 4.1 vite.config.ts 配置
```typescript
export default defineConfig({
  base: '/architect/',  // 子应用路径
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
```

### 4.2 构建命令
```bash
npm install
npm run build
```

### 4.3 部署构建产物
将 `dist/` 目录内容复制到：
```
/www/wwwroot/kbitai.com.cn/architect/
```

---

## 五、环境配置

### 5.1 后端环境变量 (.env)
在 `backend/` 目录创建 `.env` 文件：
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=kbit_architect
DB_USERNAME=root
DB_PASSWORD=your_password

# JWT密钥
JWT_SECRET=your-random-jwt-secret-key

# 加密密钥
ENCRYPTION_KEY=your-32-char-encryption-key

# 调试模式
APP_DEBUG=false

# PH8 网关配置（AI模型调用）
PH8_API_KEY=your_ph8_api_key
PH8_GATEWAY_URL=https://ph8.co
PH8_ENABLED=true

# Tavily Search API（海外联网搜索）
TAVILY_API_KEY=your_tavily_api_key

# 百度图像搜索 API（以图搜图）
BAIDU_APP_ID=your_baidu_app_id
BAIDU_API_KEY=your_baidu_api_key
BAIDU_SECRET_KEY=your_baidu_secret_key
```

### 5.2 生成密钥
```bash
# JWT密钥
openssl rand -hex 32

# 加密密钥
openssl rand -hex 16
```

---

## 六、API 接口

所有 API 接口前缀为 `/architect/backend/api/`

### 6.1 认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/logout | 用户登出 |
| GET | /api/auth/me | 获取当前用户 |

### 6.2 订阅接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/subscription/plans | 获取订阅方案 |
| POST | /api/subscription/subscribe | 创建订阅 |
| POST | /api/subscription/activate-license | 激活授权口令 |

### 6.3 路由接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/routing/select | 智能模型选择 |
| GET | /api/routing/models | 获取可用模型 |
| POST | /api/routing/check-quota | 检查配额 |

### 6.4 搜索接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/search/web | 联网搜索（文本搜索） |
| POST | /api/search/similar | 以图搜图（相似图片搜索） |

---

## 七、联网搜索功能

### 7.1 双搜索源系统
- **国内用户**：百度搜索（自动降级兜底）
- **海外用户**：Tavily Search（Pro用户专用）

### 7.2 以图搜图
当用户上传底图时，系统自动调用百度相似图片搜索 API，返回与底图风格相似的设计案例图片。

### 7.3 搜索触发
- 用户上传图片时自动触发
- 无需手动开关

---

## 八、授权口令

| 口令 | 等级 | 有效期 |
|------|------|--------|
| KBIT-BASIC-2025 | 基础级 | 1个月 |
| KBIT-PRO-2025 | PRO级 | 1个月 |
| KBIT-PLUS-2025 | PLUS级 | 1个月 |
| KBIT-BASIC-2025-Y | 基础级 | 12个月 |
| KBIT-PRO-2025-Y | PRO级 | 12个月 |
| KBIT-PLUS-2025-Y | PLUS级 | 12个月 |

---

## 九、访问地址汇总

| 功能 | 地址 |
|------|------|
| 前端应用 | https://www.kbitai.com.cn/architect/ |
| 管理后台 | https://www.kbitai.com.cn/architect/admin/ |
| API接口 | https://www.kbitai.com.cn/architect/backend/api/ |
| 健康检查 | https://www.kbitai.com.cn/architect/backend/api/health |

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
