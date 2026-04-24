#!/bin/bash

echo "=== 检查服务器文件版本 ==="

# 检查后端文件
echo -e "\n1. 后端文件:"
ls -la /www/wwwroot/api.kbitai.com.cn/server.js
ls -la /www/wwwroot/api.kbitai.com.cn/services/mailService.js
ls -la /www/wwwroot/api.kbitai.com.cn/controllers/adminController.js
ls -la /www/wwwroot/api.kbitai.com.cn/admin/reset-password.html

# 检查 Nginx 配置
echo -e "\n2. Nginx 配置:"
ls -la /www/server/panel/vhost/nginx/www.kbitai.com.cn.conf

# 检查关键配置内容
echo -e "\n3. 检查 /admin/ 代理配置:"
grep -A 5 "location /admin/" /www/server/panel/vhost/nginx/www.kbitai.com.cn.conf

echo -e "\n4. 检查 /api/admin/ 代理配置:"
grep -A 5 "location /api/admin/" /www/server/panel/vhost/nginx/www.kbitai.com.cn.conf

# 测试 API
echo -e "\n5. 测试管理员登录 API:"
curl -s -X POST https://www.kbitai.com.cn/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | head -c 100