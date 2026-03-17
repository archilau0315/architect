# 部署与邀请码注册完整方案

## 一、服务器环境

- 域名：`https://www.kbitai.com.cn`
- 宝塔面板
- MySQL 数据库名：`kbitai0302`
- SSL 证书已配置
- FFmpeg 版本：6.1

---

## 二、实施步骤

### 步骤1：更新数据库表结构
**文件：** `backend/database.sql`
**内容：** 添加邀请码表

### 步骤2：创建邀请码 API
**文件：** `backend/routes/invite.js`（新建）
**内容：** 邀请码生成、验证、注册 API

### 步骤3：创建后端水印 API
**文件：** `backend/routes/watermark.js`（新建）
**内容：** 图片/视频水印处理 API

### 步骤4：更新后端主文件
**文件：** `backend/server.js`
**内容：** 引入邀请码和水印模块

### 步骤5：前端添加邀请码注册
**文件：** `components/SettingsPanel.tsx`
**内容：** 在账户体系页面添加邀请码注册入口

### 步骤6：创建部署文档
**文件：** `DEPLOYMENT.md`（新建）

### 步骤7：创建项目说明
**文件：** `README.md`（新建）

---

## 三、邀请码注册流程

1. 管理员生成邀请码
2. 用户输入邀请码 + 邮箱注册
3. 注册成功后自动成为 Beta 用户
4. 获得 1000 积分体验金

---

## 四、水印后端支持

### 图片水印 API
- 接口：`POST /api/watermark/image`
- 使用 Node.js + Canvas 处理

### 视频水印 API
- 接口：`POST /api/watermark/video`
- 使用服务器 FFmpeg 处理

---

## 五、文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/database.sql` | 修改 | 添加邀请码表 |
| `backend/routes/invite.js` | 新建 | 邀请码模块 |
| `backend/routes/watermark.js` | 新建 | 水印处理模块 |
| `backend/server.js` | 修改 | 引入新模块 |
| `components/SettingsPanel.tsx` | 修改 | 添加邀请码注册 |
| `DEPLOYMENT.md` | 新建 | 部署文档 |
| `README.md` | 新建 | 项目说明 |
