<?php
/**
 * 服务器状态检查脚本
 * 用于检查数据库连接和服务器状态
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

// 加载配置
require __DIR__ . '/config/database.php';
require __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

// 检查Database类是否存在
if (!class_exists('KbitArchitect\Core\Database')) {
    die("Database类不存在，请检查includes/Database.php文件");
}

echo "=== 服务器状态检查 ===\n";

try {
    // 检查数据库连接
    echo "1. 检查数据库连接...\n";
    $db = Database::getInstance();
    echo "   ✅ 数据库连接成功\n";
    
    // 检查用户表是否存在
    echo "2. 检查用户表是否存在...\n";
    $result = $db->query("SHOW TABLES LIKE 'kbit_users'");
    if (count($result) > 0) {
        echo "   ✅ 用户表 kbit_users 存在\n";
    } else {
        echo "   ❌ 用户表 kbit_users 不存在\n";
    }
    
    // 检查邀请码表是否存在
    echo "3. 检查邀请码表是否存在...\n";
    $result = $db->query("SHOW TABLES LIKE 'invite_codes'");
    if (count($result) > 0) {
        echo "   ✅ 邀请码表 invite_codes 存在\n";
    } else {
        echo "   ❌ 邀请码表 invite_codes 不存在\n";
    }
    
    // 检查表结构
    echo "4. 检查用户表结构...\n";
    $result = $db->query("DESCRIBE kbit_users");
    if (count($result) > 0) {
        echo "   ✅ 用户表结构正常\n";
        // 显示部分字段
        echo "   部分字段: ";
        $fields = array_slice($result, 0, 5);
        $fieldNames = array_column($fields, 'Field');
        echo implode(', ', $fieldNames) . "...\n";
    } else {
        echo "   ❌ 无法获取用户表结构\n";
    }
    
    echo "\n=== 检查完成 ===\n";
    echo "服务器状态正常\n";
    
} catch (Exception $e) {
    echo "\n=== 错误信息 ===\n";
    echo "错误类型: " . get_class($e) . "\n";
    echo "错误信息: " . $e->getMessage() . "\n";
    echo "错误文件: " . $e->getFile() . "\n";
    echo "错误行号: " . $e->getLine() . "\n";
    echo "\n=== 检查完成 ===\n";
}
?>