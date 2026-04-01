#!/bin/bash

# 修复内测申请批准和使用日志问题的脚本（最终版本 v2）

echo "开始修复内测申请批准和使用日志问题..."

# 切换到后端目录
cd /www/wwwroot/api.kbitai.com.cn || exit 1

echo "当前目录: $(pwd)"

# 1. 修复文件权限
echo "\n1. 修复文件权限..."
chmod -R 755 . 2>/dev/null
chmod 644 .env 2>/dev/null

# 2. 执行数据库表结构修复
echo "\n2. 修复数据库表结构..."
mysql -u kbitai0302 -pkbitai2026 kbitai0302 < fix_database_final.sql

# 3. 测试内测申请批准功能
echo "\n3. 测试内测申请批准功能..."
cat > test_beta_final.php << 'EOF'
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
    
    // 检查beta_applications表结构
    echo "\n检查beta_applications表结构...\n";
    $result = $db->query('DESCRIBE beta_applications');
    foreach ($result as $field) {
        echo "字段: {$field['Field']} - 类型: {$field['Type']} - 空: {$field['Null']} - 默认: {$field['Default']}\n";
    }
    
    // 检查usage_logs表结构
    echo "\n检查usage_logs表结构...\n";
    $result = $db->query('DESCRIBE usage_logs');
    foreach ($result as $field) {
        echo "字段: {$field['Field']} - 类型: {$field['Type']} - 空: {$field['Null']} - 默认: {$field['Default']}\n";
    }
    
    // 检查待处理的内测申请
    $pendingApps = $db->query('SELECT * FROM beta_applications WHERE status = "pending"');
    echo "\n待处理申请数量: " . count($pendingApps) . "\n";
    
    if (count($pendingApps) > 0) {
        $app = $pendingApps[0];
        echo "测试批准申请 ID: " . $app['id'] . " - 邮箱: " . $app['email'] . " - 状态: " . $app['status'] . " - 申请时间: " . $app['applied_at'] . "\n";
        
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
                echo "✅ 用户创建成功: ID: " . $user['user_id'] . " - 邮箱: " . $user['email'] . " - 等级: " . $user['tier'] . " - 状态: " . $user['status'] . "\n";
            } else {
                echo "❌ 用户创建失败\n";
            }
        } else {
            echo "❌ 批准失败: " . $result['error'] . "\n";
        }
    } else {
        echo "没有待处理的内测申请\n";
    }
    
    // 检查使用日志
    echo "\n4. 检查使用日志...\n";
    $logs = $db->query('SELECT * FROM usage_logs LIMIT 10');
    echo "使用日志数量: " . count($logs) . "\n";
    if (count($logs) > 0) {
        foreach ($logs as $log) {
            echo "日志 ID: {$log['id']} - 用户: {$log['user_id']} - 功能: {$log['feature']} - 状态: {$log['status']} - 时间: {$log['created_at']}\n";
        }
    } else {
        echo "使用日志为空，创建测试日志...\n";
        // 创建测试日志（只插入存在的字段）
        $db->insert('usage_logs', [
            'user_id' => 'test_user',
            'feature' => 'test_feature',
            'input_tokens' => 100,
            'completion_tokens' => 200,
            'total_tokens' => 300,
            'points_cost' => 10,
            'actual_cost' => 0.1,
            'status' => 'success',
            'error_message' => null,
            'request_id' => uniqid(),
            'created_at' => date('Y-m-d H:i:s')
        ]);
        echo "✅ 测试日志创建成功\n";
        
        // 再次检查
        $logs = $db->query('SELECT * FROM usage_logs LIMIT 10');
        echo "使用日志数量: " . count($logs) . "\n";
        if (count($logs) > 0) {
            foreach ($logs as $log) {
                echo "日志 ID: {$log['id']} - 用户: {$log['user_id']} - 功能: {$log['feature']} - 状态: {$log['status']} - 时间: {$log['created_at']}\n";
            }
        }
    }
    
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
}
EOF

php test_beta_final.php
rm test_beta_final.php

# 4. 修复AdminController.php中的字段名问题
echo "\n4. 修复AdminController.php中的字段名问题..."
sed -i 's/daily_quota/daily_points/g' controllers/AdminController.php

# 5. 清理临时文件
echo "\n5. 清理临时文件..."
rm -f test_beta_final.php

echo "\n修复完成！请尝试重新批准内测申请。"
echo "如果仍然遇到问题，请检查服务器错误日志。"
