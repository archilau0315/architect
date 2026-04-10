<?php
/**
 * 检查积分数据脚本
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

echo "=== 检查积分数据 ===\n\n";

try {
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    
    // 查看 kbit_users 表中的积分字段
    echo "1. kbit_users 表结构:\n";
    $columns = $db->query("DESCRIBE kbit_users");
    foreach ($columns as $col) {
        if (strpos($col['Field'], 'point') !== false || strpos($col['Field'], 'token') !== false || strpos($col['Field'], 'consume') !== false) {
            echo "   - {$col['Field']}: {$col['Type']}\n";
        }
    }
    
    // 查看用户的积分数据
    echo "\n2. 用户积分数据:\n";
    $users = $db->query("SELECT id, email, daily_points, purchased_points, total_consumed_points FROM kbit_users WHERE status = 1");
    foreach ($users as $user) {
        echo "   ID: {$user['id']}, 邮箱: {$user['email']}\n";
        echo "      每日积分: {$user['daily_points']}, 购买积分: {$user['purchased_points']}, 总消耗: {$user['total_consumed_points']}\n";
    }
    
    // 查看 token_usage 表中的数据
    echo "\n3. token_usage 表数据:\n";
    $records = $db->query("SELECT user_id, total_tokens, request_type, created_at FROM token_usage ORDER BY created_at DESC LIMIT 10");
    foreach ($records as $record) {
        $oldPoints = ceil($record['total_tokens'] / 150);
        $newPoints = ceil($record['total_tokens'] / 100);
        echo "   用户: {$record['user_id']}\n";
        echo "      Token: {$record['total_tokens']}, 类型: {$record['request_type']}\n";
        echo "      旧积分(1:150): {$oldPoints}, 新积分(1:100): {$newPoints}, 差额: +" . ($newPoints - $oldPoints) . "\n";
    }
    
    // 统计每个用户的 Token 消耗
    echo "\n4. 按用户统计 Token 消耗:\n";
    $stats = $db->query("SELECT user_id, SUM(total_tokens) as total FROM token_usage GROUP BY user_id");
    foreach ($stats as $stat) {
        $oldPoints = ceil($stat['total'] / 150);
        $newPoints = ceil($stat['total'] / 100);
        echo "   用户: {$stat['user_id']}\n";
        echo "      总Token: {$stat['total']}, 旧积分: {$oldPoints}, 新积分: {$newPoints}, 差额: +" . ($newPoints - $oldPoints) . "\n";
    }
    
    echo "\n=== 检查完成 ===\n";
    
} catch (Exception $e) {
    echo "\n❌ 错误: " . $e->getMessage() . "\n";
    exit(1);
}
