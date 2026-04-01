#!/bin/bash

# 最终修复脚本

echo "开始最终修复..."

# 切换到后端目录
cd /www/wwwroot/api.kbitai.com.cn || exit 1

echo "当前目录: $(pwd)"

# 1. 修复AdminController.php中的字段名和用户创建逻辑
echo "\n1. 修复AdminController.php..."
sed -i "s/'password_hash' =>/'password' =>/g" controllers/AdminController.php
sed -i "s/'status' => 'active'/'status' => 1/g" controllers/AdminController.php
sed -i "s/'status' => 'active'/'status' => 1/g" controllers/AdminController.php

# 2. 修复用户创建逻辑
echo "\n2. 修复用户创建逻辑..."
sed -i '/if (!\$existingUser) {/,/\$userId = \$user_id;/c\            if (!\$existingUser) {\n                // 创建新用户\n                \$this->db->insert(\'users\', [\n                    \'email\' => \$requestData[\'email\'],\n                    \'password\' => password_hash(\'beta123\', PASSWORD_DEFAULT),\n                    \'tier\' => \'basic\',\n                    \'daily_points\' => 100,\n                    \'status\' => 1,\n                    \'created_at\' => date(\'Y-m-d H:i:s\'),\n                    \'updated_at\' => date(\'Y-m-d H:i:s\')\n                ]);\n                // 获取刚插入的用户ID\n                \$userId = \$this->db->queryOne(\'SELECT user_id FROM users WHERE email = ?\', [\$requestData[\'email\']])[\'user_id\'];' controllers/AdminController.php

# 3. 测试修复结果
echo "\n3. 测试修复结果..."
cat > test_final.php << 'EOF'
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
        echo "测试批准申请 ID: " . $app['id'] . " - 邮箱: " . $app['email'] . " - 申请时间: " . $app['applied_at'] . "\n";
        
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
    echo "\n检查使用日志...\n";
    $logs = $db->query('SELECT * FROM usage_logs LIMIT 10');
    echo "使用日志数量: " . count($logs) . "\n";
    if (count($logs) > 0) {
        foreach ($logs as $log) {
            echo "日志 ID: {$log['id']} - 用户: {$log['user_id']} - 功能: {$log['feature']} - 状态: {$log['status']} - 时间: {$log['created_at']}\n";
        }
    } else {
        echo "使用日志为空\n";
    }
    
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
}

echo "\n测试完成！";
EOF

php test_final.php
rm test_final.php

# 4. 修复时间显示问题
echo "\n4. 修复时间显示问题..."
sed -i "s/new Date(request.applied_at).toLocaleString()/new Date(request.applied_at.replace(' ', 'T')).toLocaleString()/g" admin/beta.php
sed -i "s/new Date(log.created_at).toLocaleString()/new Date(log.created_at.replace(' ', 'T')).toLocaleString()/g" admin/dashboard.php
sed -i "s/new Date(log.created_at).toLocaleString()/new Date(log.created_at.replace(' ', 'T')).toLocaleString()/g" admin/logs.php

# 5. 清理临时文件
echo "\n5. 清理临时文件..."
rm -f test_final.php

echo "\n修复完成！请尝试重新批准内测申请。"
echo "时间显示问题也已修复。"
echo "如果仍然遇到问题，请检查服务器错误日志。"
