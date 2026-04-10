<?php
/**
 * 积分换算比例迁移脚本
 * 将历史数据从 1:150 改为 1:100
 * 
 * 执行前请确保：
 * 1. 已备份数据库
 * 2. 网站已维护模式
 * 3. 没有其他进程在写入数据
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

// 配置
const OLD_RATIO = 150;  // 旧比例：1积分 = 150 token
const NEW_RATIO = 100;  // 新比例：1积分 = 100 token

echo "=== 积分换算比例迁移脚本 ===\n";
echo "旧比例: 1积分 = " . OLD_RATIO . " token\n";
echo "新比例: 1积分 = " . NEW_RATIO . " token\n";
echo "\n";

try {
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    
    // 开始事务
    $db->getConnection()->beginTransaction();
    
    echo "1. 备份当前数据...\n";
    
    // 创建备份表
    $backupTable = 'token_usage_backup_' . date('Ymd_His');
    $db->query("CREATE TABLE {$backupTable} LIKE token_usage");
    $db->query("INSERT INTO {$backupTable} SELECT * FROM token_usage");
    echo "   ✓ 已创建备份表: {$backupTable}\n";
    
    // 备份用户表
    $backupUsersTable = 'kbit_users_backup_' . date('Ymd_His');
    $db->query("CREATE TABLE {$backupUsersTable} LIKE kbit_users");
    $db->query("INSERT INTO {$backupUsersTable} SELECT * FROM kbit_users");
    echo "   ✓ 已创建用户备份表: {$backupUsersTable}\n";
    
    echo "\n2. 重新计算用户积分消耗...\n";
    
    // 获取所有用户
    $users = $db->query("SELECT id, email, total_consumed_points FROM kbit_users WHERE status = 1");
    
    $updatedCount = 0;
    $totalOldPoints = 0;
    $totalNewPoints = 0;
    
    foreach ($users as $user) {
        $userId = $user['id'];
        
        // 获取该用户的所有 token 使用记录
        $usageRecords = $db->query(
            "SELECT id, total_tokens FROM token_usage WHERE user_id = ?",
            [$userId]
        );
        
        // 计算新的总积分消耗
        $newTotalPoints = 0;
        foreach ($usageRecords as $record) {
            // 按新比例计算积分（向上取整）
            $points = ceil($record['total_tokens'] / NEW_RATIO);
            $newTotalPoints += $points;
        }
        
        // 获取旧的积分消耗
        $oldTotalPoints = $user['total_consumed_points'] ?? 0;
        
        // 更新用户表
        $db->query(
            "UPDATE kbit_users SET total_consumed_points = ? WHERE id = ?",
            [$newTotalPoints, $userId]
        );
        
        $totalOldPoints += $oldTotalPoints;
        $totalNewPoints += $newTotalPoints;
        $updatedCount++;
        
        if ($updatedCount % 10 == 0) {
            echo "   已处理 {$updatedCount} 个用户...\r";
        }
    }
    
    echo "\n   ✓ 已更新 {$updatedCount} 个用户的积分消耗\n";
    echo "   旧总消耗: {$totalOldPoints} 积分\n";
    echo "   新总消耗: {$totalNewPoints} 积分\n";
    echo "   差额: " . ($totalNewPoints - $totalOldPoints) . " 积分\n";
    
    echo "\n3. 提交事务...\n";
    $db->getConnection()->commit();
    
    echo "\n=== 迁移完成 ===\n";
    echo "备份表:\n";
    echo "  - {$backupTable}\n";
    echo "  - {$backupUsersTable}\n";
    echo "\n如需回滚，请执行:\n";
    echo "  1. 恢复 token_usage: DROP TABLE token_usage; RENAME TABLE {$backupTable} TO token_usage;\n";
    echo "  2. 恢复 kbit_users: DROP TABLE kbit_users; RENAME TABLE {$backupUsersTable} TO kbit_users;\n";
    
} catch (Exception $e) {
    echo "\n❌ 错误: " . $e->getMessage() . "\n";
    
    // 回滚事务
    if (isset($db)) {
        $db->getConnection()->rollBack();
        echo "已回滚所有更改\n";
    }
    
    exit(1);
}
