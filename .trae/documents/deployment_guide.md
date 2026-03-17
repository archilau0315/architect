# 应用部署指南

## 概述

本应用是一个 Vite + React 前端项目，需要构建后部署到服务器。

---

## 部署方式对比

| 方式 | 优点 | 缺点 | 适合场景 |
|------|------|------|----------|
| **GitHub Pages** | 免费、简单 | 不支持服务端功能 | 纯静态网站 |
| **Vercel** | 免费、自动部署、支持Serverless | 国内访问可能慢 | 前端项目 |
| **自己的服务器** | 完全控制、国内访问快 | 需要服务器、需要配置 | 正式项目 |

**你的情况：** 已有服务器 `www.kbitai.com.cn`，建议直接部署到自己的服务器。

---

## 方案一：部署到自己的服务器（推荐）

### 第一步：本地构建

在项目目录下运行命令：

```bash
npm run build
```

这会在项目目录下生成一个 `dist` 文件夹，里面包含所有需要上传的文件。

### 第二步：上传到服务器

**方法A：使用 FTP 工具（如 FileZilla）**
1. 连接到你的服务器
2. 将 `dist` 文件夹里的所有文件上传到服务器的 `/architect/` 目录

**方法B：使用宝塔面板**
1. 登录宝塔面板
2. 进入文件管理
3. 上传 `dist` 文件夹内容到 `/architect/` 目录

### 第三步：服务器配置

确保 Nginx 配置正确：

```nginx
server {
    listen 80;
    server_name www.kbitai.com.cn;
    
    # 根目录欢迎页
    location = / {
        root /www/wwwroot/kbitai;  # 你的网站根目录
        index index.html;
    }
    
    # 应用目录
    location /architect/ {
        root /www/wwwroot/kbitai;
        try_files $uri $uri/ /architect/index.html;
    }
}
```

---

## 方案二：使用 GitHub + 自动部署

### 第一步：创建 GitHub 仓库

1. 登录 GitHub.com
2. 点击 "New repository" 创建新仓库
3. 仓库名可以是 `kbitai-architect`

### 第二步：上传代码到 GitHub

在项目目录运行：

```bash
git init
git add .
git commit -m "首次提交"
git branch -M main
git remote add origin https://github.com/你的用户名/kbitai-architect.git
git push -u origin main
```

### 第三步：使用 Vercel 自动部署（推荐）

1. 访问 [vercel.com](https://vercel.com)
2. 用 GitHub 账号登录
3. 点击 "Import Project"
4. 选择你的 GitHub 仓库
5. 设置：
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. 点击 "Deploy"

部署完成后，Vercel 会给你一个网址，如 `https://kbitai-architect.vercel.app`

---

## 推荐方案：自己服务器 + GitHub 备份

```
本地开发 → GitHub 备份代码 → 构建后上传到自己的服务器
```

**流程：**
1. 代码推送到 GitHub（备份）
2. 本地运行 `npm run build`
3. 将 `dist` 文件夹内容上传到服务器 `/architect/` 目录

---

## 文件结构说明

部署后的服务器目录结构：

```
/www/wwwroot/kbitai/
├── index.html          # 欢迎页（你自己创建）
├── architect/          # 本应用
│   ├── index.html
│   ├── assets/
│   │   ├── index.js
│   │   └── index.css
│   ├── archi01.png     # logo图片
│   ├── LOGOkbitwater.png
│   └── ...
```

---

## 需要帮助？

告诉我：
1. 你是否有服务器管理面板（如宝塔面板）？
2. 你是否已经注册 GitHub 账号？
3. 你更倾向于哪种部署方式？

我可以根据你的情况提供更详细的步骤指导。
