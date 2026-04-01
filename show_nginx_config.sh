#!/bin/bash
# 查找并显示 www.kbitai.com.cn 的nginx配置

echo "=== 查找nginx配置文件 ==="

# 尝试几个可能的路径
if [ -f "/www/server/panel/vhost/nginx/www.kbitai.com.cn.conf" ]; then
    echo "找到配置文件: /www/server/panel/vhost/nginx/www.kbitai.com.cn.conf"
    cat /www/server/panel/vhost/nginx/www.kbitai.com.cn.conf
elif [ -f "/www/server/panel/vhost/nginx/kbitai.com.cn.conf" ]; then
    echo "找到配置文件: /www/server/panel/vhost/nginx/kbitai.com.cn.conf"
    cat /www/server/panel/vhost/nginx/kbitai.com.cn.conf
else
    echo "未找到配置文件，列出所有nginx配置："
    ls -la /www/server/panel/vhost/nginx/*.conf
fi
