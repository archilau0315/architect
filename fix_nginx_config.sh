#!/bin/bash

# 修复 nginx 配置脚本
# 用于修复 API 路由和 Authorization header 传递问题

echo "开始修复 nginx 配置..."

# 备份原始配置文件
NGINX_CONF="/www/server/panel/vhost/nginx/api.kbitai.com.cn.conf"
if [ -f "$NGINX_CONF" ]; then
    cp "$NGINX_CONF" "${NGINX_CONF}.bak"
    echo "已备份原始配置文件到 ${NGINX_CONF}.bak"
else
    echo "错误：找不到 nginx 配置文件 $NGINX_CONF"
    exit 1
fi

# 修复 nginx 配置
sed -i '/#PHP-INFO-START/,/#PHP-INFO-END/ c\    #PHP-INFO-START  PHP引用配置，可以注释或修改\n    location ~ \\.php$ {\n        fastcgi_pass unix:/tmp/php-cgi-82.sock;\n        fastcgi_index index.php;\n        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;\n        include fastcgi_params;\n        fastcgi_param HTTP_AUTHORIZATION $http_authorization;\n    }\n    #PHP-INFO-END' "$NGINX_CONF"

# 添加 API 路由配置
if ! grep -q "location /api/" "$NGINX_CONF"; then
    sed -i '/#REWRITE-START/ i\    # API路由配置\n    location /api/ {\n        try_files $uri $uri/ /index.php$is_args$args;\n    }\n' "$NGINX_CONF"
    echo "已添加 API 路由配置"
else
    echo "API 路由配置已存在"
fi

# 测试 nginx 配置
echo "测试 nginx 配置..."
nginx -t

if [ $? -eq 0 ]; then
    echo "nginx 配置测试成功"
    echo "重启 nginx..."
    systemctl restart nginx
    echo "nginx 重启成功"
else
    echo "错误：nginx 配置测试失败"
    echo "恢复原始配置..."
    cp "${NGINX_CONF}.bak" "$NGINX_CONF"
    echo "已恢复原始配置"
    exit 1
fi

echo "nginx 配置修复完成！"
echo "现在请尝试重新登录管理后台。"
