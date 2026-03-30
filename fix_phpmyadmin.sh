#!/bin/bash

# phpMyAdmin 502错误修复脚本
# 用于修复PHP-FPM服务和phpMyAdmin访问问题

echo "=========================================="
echo "phpMyAdmin 502错误修复"
echo "=========================================="

# 检查PHP-FPM服务状态
echo -e "\n1. 检查PHP-FPM服务状态:"
if systemctl is-active --quiet php8.2-fpm; then
    echo "PHP 8.2 FPM服务正在运行"
else
    echo "PHP 8.2 FPM服务未运行，尝试启动..."
    systemctl start php8.2-fpm
    if [ $? -eq 0 ]; then
        echo "PHP 8.2 FPM服务启动成功"
    else
        echo "PHP 8.2 FPM服务启动失败"
        echo "尝试使用宝塔命令启动..."
        /etc/init.d/php-fpm-82 start
    fi
fi

# 检查PHP-FPM监听配置
echo -e "\n2. 检查PHP-FPM监听配置:"
PHP_FPM_CONF="/www/server/php/82/etc/php-fpm.conf"
if [ -f "$PHP_FPM_CONF" ]; then
    LISTEN_CONFIG=$(grep -E "^listen\s*=" "$PHP_FPM_CONF")
    echo "当前配置: $LISTEN_CONFIG"
    
    # 如果配置为socket，改为TCP端口
    if echo "$LISTEN_CONFIG" | grep -q "sock"; then
        echo "检测到socket配置，修改为TCP端口..."
        sed -i 's|^listen\s*=.*|listen = 127.0.0.1:9000|' "$PHP_FPM_CONF"
        echo "配置已修改为TCP端口"
        
        # 重启PHP-FPM服务
        echo "重启PHP-FPM服务..."
        systemctl restart php8.2-fpm 2>/dev/null || /etc/init.d/php-fpm-82 restart
    fi
else
    echo "未找到PHP-FPM配置文件"
fi

# 检查nginx配置
echo -e "\n3. 检查nginx配置:"
NGINX_CONF="/www/server/panel/vhost/nginx/api.kbitai.com.cn.conf"
if [ -f "$NGINX_CONF" ]; then
    if grep -q "fastcgi_pass unix:/tmp/php-cgi-82.sock" "$NGINX_CONF"; then
        echo "nginx配置使用socket连接，需要修改为TCP端口"
        echo "请手动修改nginx配置文件，将："
        echo "  fastcgi_pass unix:/tmp/php-cgi-82.sock;"
        echo "改为："
        echo "  fastcgi_pass 127.0.0.1:9000;"
    else
        echo "nginx配置已正确使用TCP端口"
    fi
else
    echo "未找到nginx配置文件"
fi

# 检查phpMyAdmin目录权限
echo -e "\n4. 检查phpMyAdmin目录权限:"
PHPMYADMIN_DIR="/www/server/phpmyadmin"
if [ -d "$PHPMYADMIN_DIR" ]; then
    echo "phpMyAdmin目录权限:"
    ls -la "$PHPMYADMIN_DIR" | head -5
    
    # 设置正确的权限
    echo "设置正确的权限..."
    chown -R www:www "$PHPMYADMIN_DIR"
    chmod -R 755 "$PHPMYADMIN_DIR"
    echo "权限设置完成"
else
    echo "phpMyAdmin目录不存在"
fi

# 重启服务
echo -e "\n5. 重启服务:"
echo "重启nginx..."
systemctl restart nginx
echo "重启PHP-FPM..."
systemctl restart php8.2-fpm 2>/dev/null || /etc/init.d/php-fpm-82 restart

# 验证服务状态
echo -e "\n6. 验证服务状态:"
echo "nginx状态:"
systemctl status nginx | grep -E "Active:"
echo "PHP-FPM状态:"
systemctl status php8.2-fpm 2>/dev/null | grep -E "Active:" || echo "无法获取PHP-FPM状态"

echo -e "\n=========================================="
echo "修复完成"
echo "=========================================="
echo "请尝试访问phpMyAdmin："
echo "http://您的服务器IP/phpmyadmin"
echo "如果仍有问题，请检查错误日志："
echo "tail -f /www/wwwlogs/api.kbitai.com.cn.error.log"
