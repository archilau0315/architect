<?php
/**
 * 调试 PH8 API 响应格式
 * 查看实际的 usage 数据结构
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

echo "=== PH8 API 响应调试 ===\n\n";

try {
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    
    // 查看 token_usage 表的完整结构
    echo "1. token_usage 表结构:\n";
    $columns = $db->query("DESCRIBE token_usage");
    foreach ($columns as $col) {
        echo "   - {$col['Field']}: {$col['Type']}\n";
    }
    
    // 查看最近的几条记录的所有字段
    echo "\n2. 最近 5 条记录的完整数据:\n";
    $records = $db->query("SELECT * FROM token_usage ORDER BY created_at DESC LIMIT 5");
    foreach ($records as $record) {
        echo "\n   记录 ID: {$record['id']}\n";
        echo "   - user_id: {$record['user_id']}\n";
        echo "   - request_id: {$record['request_id']}\n";
        echo "   - model: {$record['model']}\n";
        echo "   - prompt_tokens: {$record['prompt_tokens']}\n";
        echo "   - completion_tokens: {$record['completion_tokens']}\n";
        echo "   - total_tokens: {$record['total_tokens']}\n";
        echo "   - cached_tokens: {$record['cached_tokens']}\n";
        echo "   - request_type: {$record['request_type']}\n";
        echo "   - created_at: {$record['created_at']}\n";
    }
    
    // 统计信息
    echo "\n3. 统计信息:\n";
    $stats = $db->queryOne("SELECT 
        COUNT(*) as total_records,
        AVG(total_tokens) as avg_tokens,
        MIN(total_tokens) as min_tokens,
        MAX(total_tokens) as max_tokens,
        SUM(total_tokens) as sum_tokens
    FROM token_usage");
    
    echo "   - 总记录数: {$stats['total_records']}\n";
    echo "   - 平均 total_tokens: {$stats['avg_tokens']}\n";
    echo "   - 最小 total_tokens: {$stats['min_tokens']}\n";
    echo "   - 最大 total_tokens: {$stats['max_tokens']}\n";
    echo "   - 总和 total_tokens: {$stats['sum_tokens']}\n";
    
    echo "\n=== 调试完成 ===\n";
    
} catch (Exception $e) {
    echo "\n❌ 错误: " . $e->getMessage() . "\n";
    exit(1);
}
