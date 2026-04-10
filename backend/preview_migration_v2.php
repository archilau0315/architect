<?php
/**
 * 积分迁移预览脚本 V2
 * 显示所有用户的 Token 消耗统计
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

const OLD_RATIO = 150;
const NEW_RATIO = 100;

echo "=== 积分迁移预览 V2 ===\n\n";

try {
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    
    // 统计总记录数
    $totalRecords = $db->queryOne("SELECT COUNT(*) as count FROM token_usage");
    echo "Token 使用记录总数: {$totalRecords['count']}\n\n";
    
    // 获取所有不同的 user_id
    $userIds = $db->query("SELECT DISTINCT user_id FROM token_usage");
    echo "不同用户标识数: " . count($userIds) . "\n\n";
    
    // 统计每个用户的 Token 消耗
    echo "每个用户的 Token 消耗统计:\n";
    echo str_repeat("-", 90) . "\n";
    echo sprintf("%-35s %-12s %-10s %-10s %-10s %-10s\n", 
        "用户标识", "请求数", "总Token", "旧积分", "新积分", "差额");
    echo str_repeat("-", 90) . "\n";
    
    $grandTotalOld = 0;
    $grandTotalNew = 0;
    $grandTotalTokens = 0;
    $grandTotalRequests = 0;
    
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
        $diff = $newPoints - $oldPoints;
        
        $displayId = strlen($userId) > 35 ? substr($userId, 0, 32) . '...' : $userId;
        
        echo sprintf("%-35s %-12s %-10s %-10s %-10s %-10s\n", 
            $displayId,
            $stats['request_count'],
            $stats['total_tokens'],
            $oldPoints,
            $newPoints,
            ($diff > 0 ? '+' : '') . $diff
        );
        
        $grandTotalOld += $oldPoints;
        $grandTotalNew += $newPoints;
        $grandTotalTokens += $stats['total_tokens'];
        $grandTotalRequests += $stats['request_count'];
    }
    
    echo str_repeat("-", 90) . "\n";
    echo sprintf("%-35s %-12s %-10s %-10s %-10s %-10s\n", 
        "合计", 
        $grandTotalRequests,
        $grandTotalTokens,
        $grandTotalOld, 
        $grandTotalNew, 
        '+' . ($grandTotalNew - $grandTotalOld));
    
    echo "\n\n按请求类型统计:\n";
    echo str_repeat("-", 70) . "\n";
    echo sprintf("%-20s %-12s %-10s %-10s %-10s\n", 
        "请求类型", "请求数", "总Token", "旧积分", "新积分");
    echo str_repeat("-", 70) . "\n";
    
    $typeStats = $db->query(
        "SELECT request_type, 
                COUNT(*) as request_count, 
                SUM(total_tokens) as total_tokens 
         FROM token_usage 
         GROUP BY request_type"
    );
    
    foreach ($typeStats as $stat) {
        $oldPoints = ceil($stat['total_tokens'] / OLD_RATIO);
        $newPoints = ceil($stat['total_tokens'] / NEW_RATIO);
        
        echo sprintf("%-20s %-12s %-10s %-10s %-10s\n", 
            $stat['request_type'],
            $stat['request_count'],
            $stat['total_tokens'],
            $oldPoints,
            $newPoints
        );
    }
    
    echo "\n=== 预览结束 ===\n";
    echo "\n说明:\n";
    echo "- 旧积分: 按 1:150 换算\n";
    echo "- 新积分: 按 1:100 换算\n";
    echo "- 差额: 新积分 - 旧积分\n";
    echo "\n如需执行迁移，请运行: php migrate_points_v2.php\n";
    
} catch (Exception $e) {
    echo "\n❌ 错误: " . $e->getMessage() . "\n";
    exit(1);
}
