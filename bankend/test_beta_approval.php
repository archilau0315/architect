<?php
/**
 * 测试内测申请批准功能
 * 用于诊断批准失败的问题
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/includes/Database.php';
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
    
    // 检查users表结构
    echo "\n检查users表结构...\n";
    $result = $db->query('DESCRIBE users');
    foreach ($result as $field) {
        echo "字段: {$field['Field']} - 类型: {$field['Type']} - 空: {$field['Null']} - 默认: {$field['Default']}\n";
    }
    
    // 检查待处理的内测申请
    echo "\n检查待处理的内测申请...\n";
    $pendingApps = $db->query('SELECT * FROM beta_applications WHERE status = "pending"');
    echo "待处理申请数量: " . count($pendingApps) . "\n";
    
    if (count($pendingApps) > 0) {
        $app = $pendingApps[0];
        echo "测试批准申请 ID: " . $app['id'] . " - 邮箱: " . $app['email'] . " - 状态: " . $app['status'] . "\n";
        
        // 测试批准功能
        echo "\n测试批准功能...\n";
        $adminController = new AdminController();
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
                echo "✅ 用户创建成功: ID: " . $user['user_id'] . " - 邮箱: " . $user['email'] . " - 等级: " . $user['tier'] . "\n";
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
    echo "\n检查使用日志...\n";
    $logs = $db->query('SELECT * FROM usage_logs LIMIT 10');
    echo "使用日志数量: " . count($logs) . "\n";
    if (count($logs) > 0) {
        foreach ($logs as $log) {
            echo "日志 ID: {$log['id']} - 用户: {$log['user_id']} - 功能: {$log['feature']} - 状态: {$log['status']} - 时间: {$log['created_at']}\n";
        }
    }
    
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
    echo "堆栈: " . $e->getTraceAsString() . "\n";
}

echo "\n测试完成！";
