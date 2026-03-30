#!/bin/bash

# 重启服务脚本
# 用于修复phpMyAdmin 502错误和API访问问题

echo "开始重启服务..."

# 重启nginx
echo "重启nginx服务..."
systemctl restart nginx
if [ $? -eq 0 ]; then
    echo "nginx重启成功"
else
    echo "nginx重启失败"
fi

# 检查PHP-FPM服务状态
echo "检查PHP-FPM服务..."
PHP_FPM_STATUS=$(systemctl status php8.2-fpm 2>/dev/null | grep -E "Active: (active|inactive)")

if [ -z "$PHP_FPM_STATUS" ]; then
    # 尝试其他PHP版本
    echo "尝试检查php-fpm服务..."
    PHP_FPM_STATUS=$(systemctl status php-fpm 2>/dev/null | grep -E "Active: (active|inactive)")
    
    if [ -z "$PHP_FPM_STATUS" ]; then
        echo "PHP-FPM服务未找到，尝试直接重启PHP..."
        # 对于宝塔面板，可能需要使用其特定的命令
        /etc/init.d/php-fpm-82 restart 2>/dev/null || echo "无法重启PHP-FPM"
    else
        echo "重启php-fpm服务..."
        systemctl restart php-fpm
        if [ $? -eq 0 ]; then
            echo "php-fpm重启成功"
        else
            echo "php-fpm重启失败"
        fi
    fi
else
    echo "重启php8.2-fpm服务..."
    systemctl restart php8.2-fpm
    if [ $? -eq 0 ]; then
        echo "php8.2-fpm重启成功"
    else
        echo "php8.2-fpm重启失败"
    fi
fi

# 检查服务状态
echo "\n服务状态检查："
systemctl status nginx | grep -E "Active:"
systemctl status php8.2-fpm 2>/dev/null | grep -E "Active:" || systemctl status php-fpm 2>/dev/null | grep -E "Active:"

echo "\n服务重启完成，请检查网站访问情况"
