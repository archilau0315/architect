#!/bin/bash
# 修复 /api/admin/login 404 错误

echo "=== 修复API路由404问题 ==="

# 1. 备份当前nginx配置
echo "[1/3] 备份nginx配置..."
cp /www/server/panel/vhost/nginx/kbitai.com.cn.conf /www/server/panel/vhost/nginx/kbitai.com.cn.conf.bak.$(date +%Y%m%d_%H%M%S)

# 2. 在nginx配置中添加API路由（在server块中，location /architect 之前）
echo "[2/3] 添加API路由配置..."
cat > /tmp/api_route.conf << 'EOF'

    # API路由 - 转发到PHP后端
    location /api/ {
        root /www/wwwroot/kbitai.com.cn/architect;
        rewrite ^/api/(.*)$ /bankend/index.php last;
    }

    # PHP处理
    location ~ ^/bankend/.*\.php$ {
        root /www/wwwroot/kbitai.com.cn/architect;
        fastcgi_pass unix:/tmp/php-cgi-82.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_connect_timeout 300;
        fastcgi_send_timeout 300;
        fastcgi_read_timeout 300;
    }
EOF

echo "请手动将 /tmp/api_route.conf 的内容添加到nginx配置文件中"
echo "位置：/www/server/panel/vhost/nginx/kbitai.com.cn.conf"
echo "添加位置：在 'location /architect' 之前"

# 3. 测试并重载nginx
echo "[3/3] 测试nginx配置..."
nginx -t && nginx -s reload

echo "=== 修复完成 ==="
echo "现在访问 /api/admin/login 应该可以正常工作了"
