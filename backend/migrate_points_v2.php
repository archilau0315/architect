<?php
/**
 * 积分换算比例迁移脚本 V2
 * 将历史数据从 1:150 改为 1:100
 * 支持通过 email 关联用户
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

// 配置
const OLD_RATIO = 150;
const NEW_RATIO = 100;

echo "=== 积分换算比例迁移脚本 V2 ===\n";
echo "旧比例: 1积分 = " . OLD_RATIO . " token\n";
echo "新比例: 1积分 = " . NEW_RATIO . " token\n";
echo "\n";

try {
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    
    // 注意：由于创建表会自动提交事务，我们不使用事务包裹整个迁移过程
    // 而是通过备份表来实现回滚能力
    
    echo "1. 备份当前数据...\n";
    
    // 检查 token_usage 是否是视图
    $tableInfo = $db->queryOne("SHOW FULL TABLES LIKE 'token_usage'");
    $isView = false;
    if ($tableInfo) {
        $tableType = array_values($tableInfo)[1];
        $isView = ($tableType === 'VIEW');
    }
    
    if ($isView) {
        echo "   ℹ️ token_usage 是视图，将直接查询数据而不创建备份表\n";
        $backupTable = 'token_usage (VIEW - 未备份)';
    } else {
        // 创建备份表
        $backupTable = 'token_usage_backup_' . date('Ymd_His');
        $db->query("CREATE TABLE {$backupTable} LIKE token_usage");
        $db->query("INSERT INTO {$backupTable} SELECT * FROM token_usage");
        echo "   ✓ 已创建备份表: {$backupTable}\n";
    }
    
    // 备份用户表
    $backupUsersTable = 'kbit_users_backup_' . date('Ymd_His');
    $db->query("CREATE TABLE {$backupUsersTable} LIKE kbit_users");
    $db->query("INSERT INTO {$backupUsersTable} SELECT * FROM kbit_users");
    echo "   ✓ 已创建用户备份表: {$backupUsersTable}\n";
    
    echo "\n2. 统计 token_usage 数据...\n";
    
    // 获取所有不同的 user_id
    $userIds = $db->query("SELECT DISTINCT user_id FROM token_usage");
    echo "   发现 " . count($userIds) . " 个不同的用户标识\n";
    
    // 统计每个用户的 Token 消耗
    $userStats = [];
    foreach ($userIds as $row) {
        $userId = $row['user_id'];
        
        $stats = $db->queryOne(
            "SELECT SUM(total_tokens) as total_tokens, COUNT(*) as request_count 
             FROM token_usage 
             WHERE user_id = ?",
            [$userId]
        );
        
        $oldPoints = ceil($stats['total_tokens'] / OLD_RATIO);
        $newPoints = ceil($stats['total_tokens'] / NEW_RATIO);
        
        $userStats[$userId] = [
            'total_tokens' => $stats['total_tokens'],
            'request_count' => $stats['request_count'],
            'old_points' => $oldPoints,
            'new_points' => $newPoints,
            'diff' => $newPoints - $oldPoints
        ];
    }
    
    echo "\n3. Token 使用统计:\n";
    echo str_repeat("-", 80) . "\n";
    echo sprintf("%-30s %-12s %-10s %-10s %-10s\n", 
        "用户标识", "总Token", "旧积分", "新积分", "差额");
    echo str_repeat("-", 80) . "\n";
    
    $grandTotalOld = 0;
    $grandTotalNew = 0;
    
    foreach ($userStats as $userId => $stats) {
        $displayId = strlen($userId) > 30 ? substr($userId, 0, 27) . '...' : $userId;
        echo sprintf("%-30s %-12s %-10s %-10s %-10s\n", 
            $displayId,
            $stats['total_tokens'],
            $stats['old_points'],
            $stats['new_points'],
            ($stats['diff'] > 0 ? '+' : '') . $stats['diff']
        );
        
        $grandTotalOld += $stats['old_points'];
        $grandTotalNew += $stats['new_points'];
    }
    
    echo str_repeat("-", 80) . "\n";
    echo sprintf("%-30s %-12s %-10s %-10s %-10s\n", 
        "合计", "", $grandTotalOld, $grandTotalNew, '+' . ($grandTotalNew - $grandTotalOld));
    
    echo "\n4. 更新 kbit_users 表...\n";
    
    // 获取所有注册用户
    $registeredUsers = $db->query("SELECT id, email FROM kbit_users WHERE status = 1");
    $updatedCount = 0;
    
    foreach ($registeredUsers as $user) {
        $userId = $user['id'];
        $email = $user['email'];
        
        // 查找匹配的 token_usage 记录
        // 尝试通过 email 匹配
        $matchingTokens = $db->query(
            "SELECT SUM(total_tokens) as total FROM token_usage WHERE user_id = ?",
            [$email]
        );
        
        $totalTokens = $matchingTokens[0]['total'] ?? 0;
        
        // 如果没有匹配，尝试其他方式（如 user_id 包含 email）
        if ($totalTokens == 0) {
            // 这里可以添加其他匹配逻辑
        }
        
        if ($totalTokens > 0) {
            $newPoints = ceil($totalTokens / NEW_RATIO);
            
            // 更新用户表
            $db->query(
                "UPDATE kbit_users SET total_consumed_points = ? WHERE id = ?",
                [$newPoints, $userId]
            );
            
            echo "   ✓ 用户 {$email}: {$totalTokens} Token → {$newPoints} 积分\n";
            $updatedCount++;
        }
    }
    
    echo "   已更新 {$updatedCount} 个注册用户的积分\n";
    
    echo "\n5. 完成迁移...\n";
    
    echo "\n=== 迁移完成 ===\n";
    echo "备份表:\n";
    echo "  - {$backupTable}\n";
    echo "  - {$backupUsersTable}\n";
    echo "\n统计:\n";
    echo "  - 处理了 " . count($userStats) . " 个用户的 Token 记录\n";
    echo "  - 更新了 {$updatedCount} 个注册用户的积分\n";
    echo "  - 旧总消耗: {$grandTotalOld} 积分\n";
    echo "  - 新总消耗: {$grandTotalNew} 积分\n";
    echo "  - 差额: " . ($grandTotalNew - $grandTotalOld) . " 积分\n";
    echo "\n如需回滚，请执行:\n";
    if (!$isView) {
        echo "  1. 恢复 token_usage: DROP TABLE token_usage; RENAME TABLE {$backupTable} TO token_usage;\n";
    }
    echo "  2. 恢复 kbit_users: DROP TABLE kbit_users; RENAME TABLE {$backupUsersTable} TO kbit_users;\n";
    
} catch (Exception $e) {
    echo "\n❌ 错误: " . $e->getMessage() . "\n";
    echo "\n由于发生错误，建议手动恢复备份表:\n";
    echo "  1. 恢复 kbit_users: DROP TABLE kbit_users; RENAME TABLE {$backupUsersTable} TO kbit_users;\n";
    if (!$isView) {
        echo "  2. 恢复 token_usage: DROP TABLE token_usage; RENAME TABLE {$backupTable} TO token_usage;\n";
    }
    
    exit(1);
}
