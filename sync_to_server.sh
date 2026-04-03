#!/bin/bash

# 同步脚本 - 将本地代码上传到服务器
# 服务器信息
SERVER="kbitai0302"
USER="root"
REMOTE_DIR="/www/wwwroot/kbitai.com.cn/architect"

# 本地目录
LOCAL_DIR=$(pwd)

# 排除列表
EXCLUDE_LIST="--exclude='node_modules' --exclude='.git' --exclude='.trae' --exclude='*.log'"

echo "开始同步代码到服务器..."
echo "本地目录: $LOCAL_DIR"
echo "远程目录: $USER@$SERVER:$REMOTE_DIR"

# 同步前端和后端代码
rsync -avz $EXCLUDE_LIST "$LOCAL_DIR/" "$USER@$SERVER:$REMOTE_DIR/"

if [ $? -eq 0 ]; then
    echo "代码同步成功!"
    
    # 同步nginx配置文件
    echo "同步nginx配置文件..."
    rsync -avz "$LOCAL_DIR/www.kbitai.com.cn.conf" "$USER@$SERVER:/www/server/panel/vhost/nginx/"
    
    if [ $? -eq 0 ]; then
        echo "Nginx配置同步成功!"
        
        # 重启nginx服务
        echo "重启Nginx服务..."
        ssh "$USER@$SERVER" "service nginx restart"
        
        if [ $? -eq 0 ]; then
            echo "Nginx服务重启成功!"
        else
            echo "Nginx服务重启失败，请手动重启"
        fi
        
        # 重启PHP服务
        echo "重启PHP服务..."
        ssh "$USER@$SERVER" "service php-fpm-82 restart"
        
        if [ $? -eq 0 ]; then
            echo "PHP服务重启成功!"
        else
            echo "PHP服务重启失败，请手动重启"
        fi
        
        echo "\n同步完成！"
        echo "网站应该已经可以正常访问了"
    else
        echo "Nginx配置同步失败"
    fi
else
    echo "代码同步失败"
fi