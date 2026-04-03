<?php
/**
 * 数据库表结构检查脚本
 * 用于诊断管理员后台日志功能问题
 */

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

try {
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    
    echo "=== 数据库连接成功 ===\n\n";
    
    // 检查所有表
    echo "=== 检查数据库表 ===\n";
    $tables = $db->query("SHOW TABLES");
    echo "数据库中的表:\n";
    foreach ($tables as $table) {
        $tableName = array_values($table)[0];
        echo "  - {$tableName}\n";
    }
    echo "\n";
    
    // 检查 kbit_users 表结构
    echo "=== 检查 kbit_users 表结构 ===\n";
    $kbitUsersExists = $db->queryOne("SHOW TABLES LIKE 'kbit_users'");
    if ($kbitUsersExists) {
        echo "✅ kbit_users 表存在\n";
        $columns = $db->query("DESCRIBE kbit_users");
        echo "表结构:\n";
        foreach ($columns as $col) {
            echo "  - {$col['Field']}: {$col['Type']}\n";
        }
    } else {
        echo "❌ kbit_users 表不存在\n";
    }
    echo "\n";
    
    // 检查 token_usage 表结构
    echo "=== 检查 token_usage 表结构 ===\n";
    $tokenUsageExists = $db->queryOne("SHOW TABLES LIKE 'token_usage'");
    if ($tokenUsageExists) {
        echo "✅ token_usage 表存在\n";
        $columns = $db->query("DESCRIBE token_usage");
        echo "表结构:\n";
        foreach ($columns as $col) {
            echo "  - {$col['Field']}: {$col['Type']}\n";
        }
        
        // 检查数据
        $count = $db->queryOne("SELECT COUNT(*) as count FROM token_usage");
        echo "\n数据条数: {$count['count']}\n";
        
        // 显示前5条数据的 user_id
        $samples = $db->query("SELECT user_id FROM token_usage LIMIT 5");
        echo "\n前5条数据的 user_id:\n";
        foreach ($samples as $sample) {
            echo "  - {$sample['user_id']}\n";
        }
    } else {
        echo "❌ token_usage 表不存在\n";
    }
    echo "\n";
    
    // 检查 users 表（如果存在）
    echo "=== 检查 users 表结构 ===\n";
    $usersExists = $db->queryOne("SHOW TABLES LIKE 'users'");
    if ($usersExists) {
        echo "✅ users 表存在\n";
        $columns = $db->query("DESCRIBE users");
        echo "表结构:\n";
        foreach ($columns as $col) {
            echo "  - {$col['Field']}: {$col['Type']}\n";
        }
    } else {
        echo "❌ users 表不存在\n";
    }
    echo "\n";
    
    // 测试 JOIN 查询
    echo "=== 测试 JOIN 查询 ===\n";
    try {
        $testQuery = $db->query(
            "SELECT l.*, u.email, u.nickname 
             FROM token_usage l 
             LEFT JOIN kbit_users u ON l.user_id = CAST(u.id AS CHAR) COLLATE utf8mb4_unicode_ci OR l.user_id = u.email COLLATE utf8mb4_unicode_ci 
             LIMIT 1"
        );
        echo "✅ JOIN 查询成功\n";
        echo "查询结果:\n";
        print_r($testQuery);
    } catch (Exception $e) {
        echo "❌ JOIN 查询失败: " . $e->getMessage() . "\n";
    }
    
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
}
