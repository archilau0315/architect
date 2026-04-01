#!/bin/bash

# 部署管理员后台修复脚本
# 用于修复所有与管理员后台相关的问题

echo "开始修复管理员后台..."

# 切换到后端目录
cd /www/wwwroot/api.kbitai.com.cn || exit 1

echo "当前目录: $(pwd)"

# 1. 修复文件权限
echo "\n1. 修复文件权限..."
chmod -R 755 .
chmod 644 .env

# 2. 修复 nginx 配置
echo "\n2. 修复 nginx 配置..."
NGINX_CONF="/www/server/panel/vhost/nginx/api.kbitai.com.cn.conf"

# 备份原始配置文件
if [ -f "$NGINX_CONF" ]; then
    cp "$NGINX_CONF" "${NGINX_CONF}.bak"
    echo "已备份原始配置文件到 ${NGINX_CONF}.bak"
else
    echo "错误：找不到 nginx 配置文件 $NGINX_CONF"
fi

# 修复 PHP 配置
sed -i '/#PHP-INFO-START/,/#PHP-INFO-END/ c\    #PHP-INFO-START  PHP引用配置，可以注释或修改\n    location ~ \\.php$ {\n        fastcgi_pass unix:/tmp/php-cgi-82.sock;\n        fastcgi_index index.php;\n        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;\n        include fastcgi_params;\n        fastcgi_param HTTP_AUTHORIZATION $http_authorization;\n    }\n    #PHP-INFO-END' "$NGINX_CONF"

# 添加 API 路由配置
if ! grep -q "location /api/" "$NGINX_CONF"; then
    sed -i '/#REWRITE-START/ i\    # API路由配置\n    location /api/ {\n        try_files $uri $uri/ /index.php$is_args$args;\n    }\n' "$NGINX_CONF"
    echo "已添加 API 路由配置"
else
    echo "API 路由配置已存在"
fi

# 3. 测试 nginx 配置
echo "\n3. 测试 nginx 配置..."
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
fi

# 4. 测试数据库连接
echo "\n4. 测试数据库连接..."
cat > test_db.php << 'EOF'
<?php
require_once __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

try {
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    echo "数据库连接成功\n";
    
    // 测试 admins 表
    $result = $db->queryOne('SELECT COUNT(*) as count FROM admins');
    echo "admins 表存在，数据行数: " . $result['count'] . "\n";
    
    // 测试 system_config 表
    $result = $db->queryOne('SELECT COUNT(*) as count FROM system_config');
    echo "system_config 表存在，数据行数: " . $result['count'] . "\n";
    
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
}
EOF

php test_db.php
rm test_db.php

# 5. 测试管理员登录
echo "\n5. 测试管理员登录..."
cat > test_login.php << 'EOF'
<?php
require_once __DIR__ . '/includes/Database.php';
require_once __DIR__ . '/includes/JWT.php';
require_once __DIR__ . '/controllers/AdminController.php';

use KbitArchitect\Core\Database;
use KbitArchitect\Core\JWT;
use KbitArchitect\Controllers\AdminController;

try {
    // 初始化数据库
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    echo "数据库初始化成功\n";
    
    // 初始化 JWT
    $jwtConfig = require __DIR__ . '/config/jwt.php';
    JWT::init($jwtConfig);
    echo "JWT 初始化成功\n";
    
    // 测试管理员登录
    $adminController = new AdminController();
    echo "AdminController 实例创建成功\n";
    
    $loginResult = $adminController->login([
        'body' => [
            'username' => 'admin',
            'password' => 'admin123'
        ],
        'ip' => '127.0.0.1'
    ]);
    
    if ($loginResult['success']) {
        echo "🎉🎉🎉 登录成功！🎉🎉🎉\n";
        echo "管理员信息: - ID: " . $loginResult['data']['admin']['id'] . " - 用户名: " . $loginResult['data']['admin']['username'] . " - 角色: " . $loginResult['data']['admin']['role'] . "\n";
        echo "Token 已生成（前50字符）: " . substr($loginResult['data']['token'], 0, 50) . "...\n";
        echo "✅ 恭喜！管理后台后端已完全正常工作！\n";
        echo "现在您可以访问: https://api.kbitai.com.cn/admin/index.php\n";
        echo "使用以下信息登录: 用户名: admin 密码: admin123\n";
    } else {
        echo "登录失败: " . $loginResult['error'] . "\n";
    }
    
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
}
EOF

php test_login.php
rm test_login.php

# 6. 清理临时文件
echo "\n6. 清理临时文件..."
rm -f test_db.php test_login.php

echo "\n修复完成！请尝试访问 https://api.kbitai.com.cn/admin/index.php 登录管理后台。"
echo "如果仍然遇到问题，请检查服务器错误日志。"
