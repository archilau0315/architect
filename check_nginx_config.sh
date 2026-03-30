#!/bin/bash

# 检查nginx配置问题
echo "=========================================="
echo "检查nginx配置"
echo "=========================================="

# 检查主nginx配置文件
echo -e "\n1. 检查主nginx配置文件:"
cat /etc/nginx/nginx.conf | grep -E "include|conf"

# 检查vhost目录结构
echo -e "\n2. 检查vhost目录结构:"
ls -la /www/server/panel/vhost/nginx/

# 检查api.kbitai.com.cn.conf文件
echo -e "\n3. 检查api.kbitai.com.cn.conf文件:"
cat /www/server/panel/vhost/nginx/api.kbitai.com.cn.conf | head -20

# 检查nginx_config_complete.conf文件
echo -e "\n4. 检查nginx_config_complete.conf文件:"
cat /www/server/panel/vhost/nginx/nginx_config_complete.conf | head -20

# 检查是否有其他配置文件包含nginx_config_complete.conf
echo -e "\n5. 检查是否有其他配置文件包含nginx_config_complete.conf:"
grep -r "nginx_config_complete" /etc/nginx/

# 检查nginx进程
echo -e "\n6. 检查nginx进程:"
ps aux | grep nginx | grep -v grep

# 检查nginx错误日志
echo -e "\n7. 检查nginx错误日志:"
tail -10 /var/log/nginx/error.log

echo -e "\n=========================================="
echo "检查完成"
echo "=========================================="
