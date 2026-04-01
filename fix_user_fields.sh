#!/bin/bash

# 修复用户表字段名问题

echo "开始修复用户表字段名问题..."

# 切换到后端目录
cd /www/wwwroot/api.kbitai.com.cn || exit 1

echo "当前目录: $(pwd)"

# 1. 检查users表结构
echo "\n1. 检查users表结构..."
mysql -u kbitai0302 -pkbitai2026 -e "DESCRIBE kbitai0302.users;" kbitai0302

# 2. 检查现有的用户数据
echo "\n2. 检查现有的用户数据..."
mysql -u kbitai0302 -pkbitai2026 -e "SELECT * FROM kbitai0302.users LIMIT 5;" kbitai0302

# 3. 修复AdminController.php中的字段名
echo "\n3. 修复AdminController.php中的字段名..."

# 先检查实际的字段名
ACTUAL_PASSWORD_FIELD=$(mysql -u kbitai0302 -pkbitai2026 -e "DESCRIBE kbitai0302.users;" kbitai0302 | grep -i pass | awk '{print $1}')
ACTUAL_TIER_FIELD=$(mysql -u kbitai0302 -pkbitai2026 -e "DESCRIBE kbitai0302.users;" kbitai0302 | grep -i tier | awk '{print $1}')
ACTUAL_STATUS_FIELD=$(mysql -u kbitai0302 -pkbitai2026 -e "DESCRIBE kbitai0302.users;" kbitai0302 | grep -i status | awk '{print $1}')

# 输出实际字段名
echo "实际密码字段: $ACTUAL_PASSWORD_FIELD"
echo "实际等级字段: $ACTUAL_TIER_FIELD"
echo "实际状态字段: $ACTUAL_STATUS_FIELD"

# 修复AdminController.php
if [ -n "$ACTUAL_PASSWORD_FIELD" ]; then
    sed -i "s/'password_hash' =>/'$ACTUAL_PASSWORD_FIELD' =>/g" controllers/AdminController.php
    echo "修复密码字段名"
fi

if [ -n "$ACTUAL_TIER_FIELD" ]; then
    sed -i "s/'tier' =>/'$ACTUAL_TIER_FIELD' =>/g" controllers/AdminController.php
    echo "修复等级字段名"
fi

if [ -n "$ACTUAL_STATUS_FIELD" ]; then
    sed -i "s/'status' =>/'$ACTUAL_STATUS_FIELD' =>/g" controllers/AdminController.php
    echo "修复状态字段名"
fi

# 4. 测试修复结果
echo "\n4. 测试修复结果..."
cat > test_user_fix.php << 'EOF'
<?php
require_once __DIR__ . '/includes/Database.php';
require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/models/ModelRouter.php';
require_once __DIR__ . '/models/CostController.php';
require_once __DIR__ . '/controllers/AdminController.php';

use KbitArchitect\Core\Database;
use KbitArchitect\Controllers\AdminController;

try {
    // 初始化数据库
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    echo "数据库连接成功\n";
    
    // 检查待处理的内测申请
    $pendingApps = $db->query('SELECT * FROM beta_applications WHERE status = "pending"');
    echo "待处理申请数量: " . count($pendingApps) . "\n";
    
    if (count($pendingApps) > 0) {
        $app = $pendingApps[0];
        echo "测试批准申请 ID: " . $app['id'] . " - 邮箱: " . $app['email'] . "\n";
        
        // 测试批准功能
        echo "\n测试批准功能...\n";
        $adminController = new AdminController();
        
        // 模拟认证
        $GLOBALS['auth_user'] = ['id' => 1];
        
        $result = $adminController->approveBetaRequest([
            'params' => ['id' => $app['id']]
        ]);
        
        if ($result['success']) {
            echo "✅ 批准成功: " . $result['message'] . "\n";
            
            // 检查更新后的状态
            $updatedApp = $db->queryOne('SELECT * FROM beta_applications WHERE id = ?', [$app['id']]);
            echo "更新后的状态: " . $updatedApp['status'] . " - 批准时间: " . $updatedApp['approved_at'] . "\n";
            
            // 检查是否创建了用户
            $user = $db->queryOne('SELECT * FROM users WHERE email = ?', [$app['email']]);
            if ($user) {
                echo "✅ 用户创建成功: " . json_encode($user) . "\n";
            } else {
                echo "❌ 用户创建失败\n";
            }
        } else {
            echo "❌ 批准失败: " . $result['error'] . "\n";
        }
    } else {
        echo "没有待处理的内测申请\n";
    }
    
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
}
EOF

php test_user_fix.php
rm test_user_fix.php

echo "\n修复完成！请尝试重新批准内测申请。"
echo "如果仍然遇到问题，请检查服务器错误日志。"
