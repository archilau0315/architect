#!/bin/bash

# phpMyAdmin配置修复脚本
# 用于修复phpMyAdmin配置文件和目录结构

echo "=========================================="
echo "phpMyAdmin配置修复"
echo "=========================================="

# 检查phpMyAdmin目录
PHPMYADMIN_DIR="/www/server/phpmyadmin"
if [ -d "$PHPMYADMIN_DIR" ]; then
    echo "phpMyAdmin目录存在"
    
    # 检查子目录
    SUBDIR=$(ls -d $PHPMYADMIN_DIR/phpmyadmin_* 2>/dev/null | head -1)
    if [ -n "$SUBDIR" ]; then
        echo "找到phpMyAdmin子目录: $SUBDIR"
        
        # 检查配置文件
        if [ -f "$SUBDIR/config.inc.php" ]; then
            echo "配置文件存在于子目录中"
            
            # 创建符号链接
            echo "创建符号链接..."
            ln -sf "$SUBDIR/config.inc.php" "$PHPMYADMIN_DIR/config.inc.php"
            echo "符号链接创建成功"
        else
            echo "配置文件不存在，创建默认配置..."
            
            # 创建默认配置文件
            cat > "$SUBDIR/config.inc.php" << 'EOF'
<?php
/**
 * phpMyAdmin配置文件
 */

/* 服务器配置 */
$cfg['Servers'][$i]['host'] = 'localhost';
$cfg['Servers'][$i]['port'] = '3306';
$cfg['Servers'][$i]['socket'] = '/tmp/mysql.sock';
$cfg['Servers'][$i]['connect_type'] = 'tcp';
$cfg['Servers'][$i]['extension'] = 'mysqli';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['auth_type'] = 'cookie';

/* 上传目录 */
$cfg['UploadDir'] = '';
$cfg['SaveDir'] = '';

/* 禁用警告 */
$cfg['PmaNoRelation_DisableWarning'] = true;
$cfg['SuhosinDisableWarning'] = true;
$cfg['McryptDisableWarning'] = true;

/* 登录cookie有效期 */
$cfg['LoginCookieValidity'] = 86400;

/* 最大导入文件大小 */
$cfg['MaxExactCount'] = 20000;

/* 禁用版本检查 */
$cfg['VersionCheck'] = false;

/* 允许无密码登录 */
$cfg['Servers'][$i]['AllowNoPassword'] = false;

$i++;
?>
EOF
            
            # 创建符号链接
            ln -sf "$SUBDIR/config.inc.php" "$PHPMYADMIN_DIR/config.inc.php"
            echo "默认配置文件创建成功"
        fi
        
        # 设置权限
        echo "设置权限..."
        chown -R www:www "$SUBDIR"
        chmod -R 755 "$SUBDIR"
        chown -R www:www "$PHPMYADMIN_DIR"
        chmod -R 755 "$PHPMYADMIN_DIR"
        echo "权限设置完成"
    else
        echo "未找到phpMyAdmin子目录"
    fi
else
    echo "phpMyAdmin目录不存在"
fi

# 检查nginx配置中的phpMyAdmin设置
echo -e "\n检查nginx配置中的phpMyAdmin设置..."
NGINX_CONF="/www/server/panel/vhost/nginx/api.kbitai.com.cn.conf"
if [ -f "$NGINX_CONF" ]; then
    if grep -q "phpmyadmin" "$NGINX_CONF"; then
        echo "nginx配置中包含phpMyAdmin设置"
    else
        echo "nginx配置中缺少phpMyAdmin设置"
        echo "需要添加以下配置到nginx配置文件中："
        echo ""
        echo "location /phpmyadmin {"
        echo "    alias /www/server/phpmyadmin/phpmyadmin_5df3b601b7668a67;"
        echo "    index index.php index.html index.htm;"
        echo "    location ~ ^/phpmyadmin/(.+\.php)\$ {"
        echo "        alias /www/server/phpmyadmin/phpmyadmin_5df3b601b7668a67/\$1;"
        echo "        fastcgi_pass 127.0.0.1:9000;"
        echo "        fastcgi_param SCRIPT_FILENAME \$request_filename;"
        echo "        include fastcgi_params;"
        echo "    }"
        echo "}"
    fi
fi

echo -e "\n=========================================="
echo "修复完成"
echo "=========================================="
echo "请尝试访问phpMyAdmin："
echo "http://您的服务器IP/phpmyadmin"
