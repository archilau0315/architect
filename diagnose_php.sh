#!/bin/bash

# PHP-FPM诊断脚本
# 用于检查PHP服务状态和配置

echo "=========================================="
echo "PHP-FPM 服务诊断"
echo "=========================================="

# 检查PHP-FPM进程
echo -e "\n1. 检查PHP-FPM进程:"
ps aux | grep php-fpm | grep -v grep

# 检查PHP-FPM端口监听
echo -e "\n2. 检查PHP-FPM端口监听:"
netstat -tlnp | grep :9000

# 检查PHP-FPM socket文件
echo -e "\n3. 检查PHP-FPM socket文件:"
ls -la /tmp/php-cgi-*.sock 2>/dev/null || echo "未找到socket文件"

# 检查PHP-FPM配置文件
echo -e "\n4. 检查PHP-FPM配置文件:"
if [ -f "/www/server/php/82/etc/php-fpm.conf" ]; then
    echo "找到PHP 8.2配置文件"
    grep -E "^listen\s*=" /www/server/php/82/etc/php-fpm.conf
else
    echo "未找到PHP 8.2配置文件"
fi

# 检查nginx配置
echo -e "\n5. 检查nginx配置中的PHP-FPM设置:"
grep -A 5 "location ~ \.php" /www/server/panel/vhost/nginx/api.kbitai.com.cn.conf

# 检查PHP-FPM服务状态
echo -e "\n6. 检查PHP-FPM服务状态:"
systemctl status php8.2-fpm 2>/dev/null || echo "php8.2-fpm服务未找到"

# 检查phpMyAdmin目录
echo -e "\n7. 检查phpMyAdmin目录:"
ls -la /www/server/phpmyadmin/ 2>/dev/null || echo "phpMyAdmin目录不存在"

# 检查phpMyAdmin配置
echo -e "\n8. 检查phpMyAdmin配置:"
if [ -f "/www/server/phpmyadmin/config.inc.php" ]; then
    echo "phpMyAdmin配置文件存在"
else
    echo "phpMyAdmin配置文件不存在"
fi

echo -e "\n=========================================="
echo "诊断完成"
echo "=========================================="
