# 内测功能后端管理方案

## 服务器环境
- **服务器**: 阿里云
- **域名**: https://www.kbitai.com
- **管理面板**: 宝塔
- **数据库**: MySQL

---

## 第一步：清理测试代码（立即执行）

修改 `App.tsx`，移除强制设置 beta 用户的测试代码。

---

## 第二步：数据库设计

在 MySQL 中创建以下表：

### 1. beta_users 表（内测用户）
```sql
CREATE TABLE beta_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) UNIQUE NOT NULL COMMENT '用户唯一标识',
  email VARCHAR(128) COMMENT '邮箱',
  phone VARCHAR(20) COMMENT '手机号',
  total_points INT DEFAULT 1000 COMMENT '总积分',
  daily_quota INT DEFAULT 200 COMMENT '每日额度',
  daily_used INT DEFAULT 0 COMMENT '今日已用',
  last_reset_date DATE COMMENT '上次重置日期',
  status ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending',
  apply_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  approve_at TIMESTAMP NULL COMMENT '审批时间',
  expire_at TIMESTAMP NULL COMMENT '过期时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. beta_applications 表（内测申请）
```sql
CREATE TABLE beta_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(128) NOT NULL,
  phone VARCHAR(20),
  reason TEXT COMMENT '申请理由',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  apply_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  review_at TIMESTAMP NULL,
  reviewer VARCHAR(64) COMMENT '审核人'
);
```

### 3. point_logs 表（积分日志）
```sql
CREATE TABLE point_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  amount INT COMMENT '消耗积分（负数）或获得积分（正数）',
  type ENUM('daily_reset', 'consume', 'bonus') NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 第三步：后端 API 设计

### 方案 A：Node.js + Express（推荐）

在宝塔面板中创建 Node.js 项目：

```
/www/wwwroot/api.kbitai.com/
├── server.js
├── routes/
│   ├── beta.js
│   └── user.js
├── db.js
└── package.json
```

### API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/beta/apply` | POST | 申请内测 |
| `/api/beta/status` | GET | 查询申请状态 |
| `/api/beta/approve` | POST | 审批通过（管理后台） |
| `/api/user/tier` | GET | 获取用户等级 |
| `/api/user/points` | GET | 获取积分余额 |
| `/api/user/consume` | POST | 消耗积分 |

---

## 第四步：宝塔面板配置

### 1. 创建 API 子域名
- 域名：`api.kbitai.com`
- 根目录：`/www/wwwroot/api.kbitai.com`
- Node.js 版本：18+

### 2. 配置 SSL
- 使用 Let's Encrypt 免费证书
- 或上传已有证书

### 3. 配置 Nginx 反向代理
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## 第五步：前端对接

### 1. 修改 BetaPolicyBanner.tsx
添加申请功能：
```typescript
const handleApply = async () => {
  const email = prompt('请输入您的邮箱申请内测资格：');
  if (!email) return;
  
  const res = await fetch('https://api.kbitai.com/api/beta/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  if (res.ok) {
    alert('申请已提交，请等待审核！');
  }
};
```

### 2. 修改 App.tsx
从后端获取用户等级：
```typescript
useEffect(() => {
  fetch('https://api.kbitai.com/api/user/tier', {
    credentials: 'include'
  })
    .then(res => res.json())
    .then(data => setUserTier(data.tier));
}, []);
```

---

## 第六步：管理后台（可选）

### 简易管理页面
创建 `/www/wwwroot/admin.kbitai.com/` 管理后台：

功能：
- 查看内测申请列表
- 审批/拒绝申请
- 查看用户积分使用情况
- 手动调整积分

---

## 执行顺序

1. ✅ **清理测试代码** - 立即执行
2. 🔲 **创建数据库表** - 在宝塔 phpMyAdmin 中执行
3. 🔲 **创建 API 项目** - Node.js + Express
4. 🔲 **配置域名和 SSL** - 宝塔面板操作
5. 🔲 **前端对接 API** - 修改前端代码
6. 🔲 **创建管理后台** - 可选

---

## 需要确认

1. 是否需要我提供完整的 Node.js 后端代码？
2. 管理后台是否需要？
3. 用户登录方式：邮箱？手机号？微信？
