#!/bin/bash

# 检查后端服务状态
echo "=== 后端服务状态检查 ==="

# 检查Node.js进程
ps aux | grep node

# 检查端口3001是否被占用
netstat -tuln | grep 3001

# 检查PM2状态
pm list -g pm2 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "=== PM2状态 ==="
    pm2 status
else
    echo "PM2未安装"
fi

# 检查Nginx配置
echo "=== Nginx配置检查 ==="
nginx -t

# 检查Nginx错误日志
echo "=== 最近的Nginx错误日志 ==="
tail -20 /www/wwwlogs/www.kbitai.com.cn.error.log

# 尝试重启后端服务
echo "=== 重启后端服务 ==="
cd /www/wwwroot/api.kbitai.com.cn/
npm install
pm run start

# 检查服务是否启动
sleep 5
echo "=== 服务启动状态 ==="
ps aux | grep node
