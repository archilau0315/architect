<?php
/**
 * 检查表类型脚本
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

echo "=== 检查表类型 ===\n\n";

try {
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    
    // 检查 token_usage 表类型
    echo "1. token_usage 表信息:\n";
    $result = $db->query("SHOW FULL TABLES LIKE 'token_usage'");
    foreach ($result as $row) {
        $tableName = array_values($row)[0];
        $tableType = array_values($row)[1];
        echo "   表名: {$tableName}\n";
        echo "   类型: {$tableType}\n";
    }
    
    // 检查 kbit_users 表类型
    echo "\n2. kbit_users 表信息:\n";
    $result = $db->query("SHOW FULL TABLES LIKE 'kbit_users'");
    foreach ($result as $row) {
        $tableName = array_values($row)[0];
        $tableType = array_values($row)[1];
        echo "   表名: {$tableName}\n";
        echo "   类型: {$tableType}\n";
    }
    
    // 查看当前数据库
    echo "\n3. 当前数据库:\n";
    $result = $db->queryOne("SELECT DATABASE() as db");
    echo "   数据库: {$result['db']}\n";
    
    // 查看所有表
    echo "\n4. 所有表:\n";
    $result = $db->query("SHOW FULL TABLES");
    foreach ($result as $row) {
        $tableName = array_values($row)[0];
        $tableType = array_values($row)[1];
        echo "   {$tableName} ({$tableType})\n";
    }
    
    echo "\n=== 检查完成 ===\n";
    
} catch (Exception $e) {
    echo "\n❌ 错误: " . $e->getMessage() . "\n";
    exit(1);
}
