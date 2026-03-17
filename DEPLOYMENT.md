# 首席图像架构师 - 部署指南

## 一、服务器环境

- 域名：`https://www.kbitai.com.cn`
- 宝塔面板
- MySQL 数据库名：`kbitai0302`
- SSL 证书：已配置
- FFmpeg 版本：6.1

---

## 二、前端部署

### 步骤1：打包前端

```bash
cd e:\works\Aidev\kbitainet\kbitaiHomepage\architect
npm run build
```

### 步骤2：上传到服务器

将 `dist` 目录下的所有文件上传到服务器：
```
/www/wwwroot/www.kbitai.com.cn/
```

### 步骤3：配置 Nginx

在宝塔面板中，网站设置 → 配置文件，添加：

```nginx
server {
    listen 443 ssl;
    server_name www.kbitai.com.cn;
    
    root /www/wwwroot/www.kbitai.com.cn;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 三、后端部署

### 步骤1：上传后端代码

将 `backend` 目录上传到服务器：
```
/www/wwwroot/api.kbitai.com.cn/
```

### 步骤2：安装依赖

```bash
cd /www/wwwroot/api.kbitai.com.cn
npm install
```

### 步骤3：配置环境变量

创建 `.env` 文件：
```
DB_HOST=localhost
DB_USER=kbitai0302
DB_PASSWORD=你的数据库密码
DB_NAME=kbitai0302
PORT=3001
NODE_ENV=production
```

### 步骤4：初始化数据库

在宝塔 phpMyAdmin 中执行 `database.sql` 文件内容

### 步骤5：启动服务

```bash
# 使用 PM2 守护进程
pm2 start server.js --name kbitai-api

# 或使用宝塔 Node 项目管理
```

---

## 四、邀请码管理

### 生成邀请码

管理员可以通过 API 生成邀请码：

```bash
curl -X POST https://www.kbitai.com.cn/api/invite/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 10, "pointsBonus": 1000, "expiresInDays": 30, "createdBy": "admin"}'
```

### 邀请码格式

```
KB + 8位随机字符
例如：KB3A7B9C2
```

---

## 五、文件目录结构

```
/www/wwwroot/www.kbitai.com.cn/
├── index.html
├── assets/
├── architect/
│   ├── index.html
│   └── ...
└── uploads/
    ├── KBITAI-20260317-XXXXXX_input.png
    └── KBITAI-20260317-XXXXXX_output.png

/www/wwwroot/api.kbitai.com.cn/
├── server.js
├── db.js
├── .env
├── routes/
│   ├── invite.js
│   └── watermark.js
└── node_modules/
```

---

## 六、常见问题

### Q: 邀请码无效？

检查邀请码是否已使用或过期：
```bash
curl https://www.kbitai.com.cn/api/invite/verify/KB3A7B9C2
```

### Q: 图片水印失败?

确保服务器已安装 FFmpeg：
```bash
ffmpeg -version
```

### Q: 数据库连接失败?

检查 `.env` 文件中的数据库配置是否正确

---

## 七、联系支持

如有问题，请联系： support@kbitai.com.cn
