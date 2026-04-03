# 代码同步指南

## 概述

本文档提供了将本地代码同步到服务器的详细步骤，确保本地和服务器代码保持一致。

## 准备工作

### 服务器信息
- **服务器名**: kbitai0302
- **用户名**: root
- **网站目录**: `/www/wwwroot/kbitai.com.cn/architect`
- **Nginx配置目录**: `/www/server/panel/vhost/nginx/`

### 本地环境要求

#### Windows环境
- 安装 [WinSCP](https://winscp.net/eng/download.php)
- 安装 [PuTTY](https://www.putty.org/)

#### Linux/Mac环境
- 确保安装了 `rsync` 和 `ssh`

## 同步方法

### 方法1：使用脚本自动同步（推荐）

#### Windows环境
1. 双击运行 `sync_to_server.bat` 文件
2. 按照提示输入服务器密码
3. 等待同步完成

#### Linux/Mac环境
1. 打开终端，进入项目目录
2. 运行命令：`chmod +x sync_to_server.sh`
3. 运行脚本：`./sync_to_server.sh`
4. 按照提示输入服务器密码
5. 等待同步完成

### 方法2：手动同步（备用）

#### 步骤1：上传代码文件

**使用WinSCP（Windows）**:
1. 打开WinSCP，连接到服务器
2. 本地目录：选择项目根目录
3. 远程目录：`/www/wwwroot/kbitai.com.cn/architect`
4. 选择所有文件（除了 node_modules、.git、.trae 文件夹）
5. 拖拽到远程目录

**使用命令行（Linux/Mac）**:
```bash
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='.trae' --exclude='*.log' ./ root@kbitai0302:/www/wwwroot/kbitai.com.cn/architect/
```

#### 步骤2：同步Nginx配置

**使用WinSCP**:
1. 上传 `www.kbitai.com.cn.conf` 文件到 `/www/server/panel/vhost/nginx/` 目录

**使用命令行**:
```bash
scp www.kbitai.com.cn.conf root@kbitai0302:/www/server/panel/vhost/nginx/
```

#### 步骤3：重启服务

**使用PuTTY（Windows）**:
1. 打开PuTTY，连接到服务器
2. 运行命令：`service nginx restart`
3. 运行命令：`service php-fpm-82 restart`

**使用命令行（Linux/Mac）**:
```bash
ssh root@kbitai0302 "service nginx restart && service php-fpm-82 restart"
```

## 验证同步成功

1. 打开浏览器，访问 `https://www.kbitai.com.cn`
2. 测试邀请码验证功能：
   - 进入注册页面
   - 输入邮箱和密码
   - 输入邀请码
   - 点击验证邀请码按钮
   - 确认验证成功

## 常见问题解决

### 同步失败
- 检查服务器连接是否正常
- 确认服务器密码是否正确
- 检查本地网络连接

### 网站无法访问
- 检查Nginx配置是否正确
- 确认服务是否正常运行
- 检查服务器防火墙设置

### 邀请码验证失败
- 检查数据库中的邀请码是否存在
- 查看服务器错误日志：`/www/wwwroot/kbitai.com.cn/architect/bankend/error.log`
- 确认邀请码是否在有效期内

## 技术支持

如果遇到问题，请联系技术支持：
- 邮箱：support@kbitai.com.cn
- 电话：400-123-4567

## 版本历史

- **2026-04-02**：创建同步指南
- **2026-04-01**：修复邮箱邀请码验证功能