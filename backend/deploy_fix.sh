#!/bin/bash

# 部署修复脚本
echo "开始部署修复..."
echo "===================================="

# 1. 备份当前 Nginx 配置
echo "1. 备份当前 Nginx 配置..."
cp /www/server/panel/vhost/nginx/api.kbitai.com.cn.conf /www/server/panel/vhost/nginx/api.kbitai.com.cn.conf.bak

# 2. 复制新的 Nginx 配置
echo "2. 复制新的 Nginx 配置..."
cp nginx_config.txt /www/server/panel/vhost/nginx/api.kbitai.com.cn.conf

# 3. 测试 Nginx 配置
echo "3. 测试 Nginx 配置..."
nginx -t

# 4. 重启 Nginx 服务
echo "4. 重启 Nginx 服务..."
systemctl restart nginx

# 5. 检查 Nginx 状态
echo "5. 检查 Nginx 状态..."
systemctl status nginx

# 6. 检查 PHP-FPM 状态
echo "6. 检查 PHP-FPM 状态..."
ps aux | grep php-fpm

# 7. 检查文件权限
echo "7. 检查文件权限..."
chmod -R 755 /www/wwwroot/api.kbitai.com.cn/
chmod -R 755 /www/wwwroot/api.kbitai.com.cn/admin/

# 8. 清理缓存
echo "8. 清理缓存..."
rm -rf /www/wwwroot/api.kbitai.com.cn/storage/cache/*

# 9. 测试服务
echo "9. 测试服务..."
echo "请访问以下地址验证服务："
echo "管理后台：https://api.kbitai.com.cn/admin/index.php"
echo "API 健康检查：https://api.kbitai.com.cn/api/health"

echo "===================================="
echo "部署修复完成！"
echo "请使用以下信息登录管理后台："
echo "用户名：admin"
echo "密码：admin123"
