<?php
/**
 * 积分迁移预览脚本
 * 显示迁移前后的对比，不实际修改数据
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

const OLD_RATIO = 150;
const NEW_RATIO = 100;

echo "=== 积分迁移预览 ===\n\n";

try {
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    
    // 统计总记录数
    $totalRecords = $db->queryOne("SELECT COUNT(*) as count FROM token_usage");
    echo "Token 使用记录总数: {$totalRecords['count']}\n\n";
    
    // 统计用户数量
    $totalUsers = $db->queryOne("SELECT COUNT(*) as count FROM kbit_users WHERE status = 1");
    echo "用户总数: {$totalUsers['count']}\n\n";
    
    // 获取前 10 个用户的对比数据
    echo "前 10 个用户的积分变化预览:\n";
    echo str_repeat("-", 80) . "\n";
    echo sprintf("%-5s %-20s %-15s %-15s %-10s\n", 
        "ID", "邮箱", "旧积分", "新积分", "差额");
    echo str_repeat("-", 80) . "\n";
    
    $users = $db->query("SELECT id, email, total_consumed_points FROM kbit_users WHERE status = 1 LIMIT 10");
    
    $totalOld = 0;
    $totalNew = 0;
    
    foreach ($users as $user) {
        $userId = $user['id'];
        
        // 获取该用户的 token 使用记录
        $usageRecords = $db->query(
            "SELECT total_tokens FROM token_usage WHERE user_id = ?",
            [$userId]
        );
        
        // 计算新的总积分
        $newPoints = 0;
        foreach ($usageRecords as $record) {
            $newPoints += ceil($record['total_tokens'] / NEW_RATIO);
        }
        
        $oldPoints = $user['total_consumed_points'] ?? 0;
        $diff = $newPoints - $oldPoints;
        
        $totalOld += $oldPoints;
        $totalNew += $newPoints;
        
        // 截断邮箱显示
        $email = strlen($user['email']) > 20 ? substr($user['email'], 0, 17) . '...' : $user['email'];
        
        echo sprintf("%-5s %-20s %-15s %-15s %-10s\n", 
            $userId, 
            $email, 
            $oldPoints, 
            $newPoints, 
            ($diff > 0 ? '+' : '') . $diff
        );
    }
    
    echo str_repeat("-", 80) . "\n";
    echo sprintf("%-5s %-20s %-15s %-15s %-10s\n", 
        "", "前10用户合计", $totalOld, $totalNew, '+' . ($totalNew - $totalOld));
    
    // 计算全量预估
    echo "\n\n全量预估:\n";
    
    $allUsers = $db->query("SELECT id FROM kbit_users WHERE status = 1");
    $grandTotalOld = 0;
    $grandTotalNew = 0;
    
    foreach ($allUsers as $user) {
        $userId = $user['id'];
        
        $usageRecords = $db->query(
            "SELECT total_tokens FROM token_usage WHERE user_id = ?",
            [$userId]
        );
        
        $newPoints = 0;
        foreach ($usageRecords as $record) {
            $newPoints += ceil($record['total_tokens'] / NEW_RATIO);
        }
        
        $oldPoints = $db->queryOne(
            "SELECT total_consumed_points FROM kbit_users WHERE id = ?",
            [$userId]
        );
        
        $grandTotalOld += $oldPoints['total_consumed_points'] ?? 0;
        $grandTotalNew += $newPoints;
    }
    
    echo "旧总消耗: {$grandTotalOld} 积分\n";
    echo "新总消耗: {$grandTotalNew} 积分\n";
    echo "差额: " . ($grandTotalNew - $grandTotalOld) . " 积分\n";
    if ($grandTotalOld > 0) {
        echo "增长比例: " . round((($grandTotalNew - $grandTotalOld) / $grandTotalOld) * 100, 2) . "%\n";
    } else {
        echo "增长比例: N/A (旧消耗为0)\n";
    }
    
    echo "\n=== 预览结束 ===\n";
    echo "注意: 这只是预览，没有实际修改数据\n";
    echo "如需执行迁移，请运行: php migrate_points.php\n";
    
} catch (Exception $e) {
    echo "\n❌ 错误: " . $e->getMessage() . "\n";
    exit(1);
}
