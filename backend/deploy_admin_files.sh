#!/bin/bash

# 部署管理员后台文件
echo "开始部署管理员后台文件..."

# 检查目标目录
TARGET_DIR="/www/wwwroot/api.kbitai.com.cn"
if [ ! -d "$TARGET_DIR" ]; then
    echo "错误: 目标目录 $TARGET_DIR 不存在"
    exit 1
fi

# 创建admin目录
ADMIN_DIR="$TARGET_DIR/admin"
if [ ! -d "$ADMIN_DIR" ]; then
    echo "创建admin目录..."
    mkdir -p "$ADMIN_DIR"
    chmod 755 "$ADMIN_DIR"
fi

# 复制admin文件
echo "复制admin文件..."
cp -f admin/index.php "$ADMIN_DIR/"
cp -f admin/dashboard.php "$ADMIN_DIR/"
cp -f admin/users.php "$ADMIN_DIR/"
cp -f admin/beta.php "$ADMIN_DIR/"
cp -f admin/models.php "$ADMIN_DIR/"
cp -f admin/logs.php "$ADMIN_DIR/"

# 设置权限
echo "设置文件权限..."
chmod 755 "$ADMIN_DIR"/*.php

# 复制API文件
echo "复制API文件..."
cp -f controllers/AdminController.php "$TARGET_DIR/controllers/"
cp -f routes/api.php "$TARGET_DIR/routes/"
cp -f middleware/AuthMiddleware.php "$TARGET_DIR/middleware/"

# 重启nginx
echo "重启nginx..."
service nginx restart

echo "部署完成！"
echo "请访问: https://api.kbitai.com.cn/admin/index.php"
echo "用户名: admin"
echo "密码: admin123"
