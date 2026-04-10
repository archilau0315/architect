<?php
/**
 * 修复 API Key 配置
 * 检查并确保 system_config 表中存在必要的 API Key
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

date_default_timezone_set('Asia/Shanghai');

// 加载 .env 文件
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if ((strpos($value, '"') === 0 && strrpos($value, '"') === strlen($value) - 1) ||
                (strpos($value, "'") === 0 && strrpos($value, "'") === strlen($value) - 1)) {
                $value = substr($value, 1, -1);
            }
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }
}

require_once __DIR__ . '/includes/Database.php';

use KbitArchitect\Core\Database;

try {
    // 初始化数据库连接
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    
    echo "开始检查 API Key 配置...\n";
    echo "====================================\n";
    
    // 检查 system_config 表是否存在
    $result = $db->query("SHOW TABLES LIKE 'system_config'");
    if (empty($result)) {
        echo "❌ system_config 表不存在，正在创建...\n";
        
        // 创建 system_config 表
        $createTableSql = "
        CREATE TABLE IF NOT EXISTS system_config (
            id INT AUTO_INCREMENT PRIMARY KEY,
            config_key VARCHAR(255) NOT NULL UNIQUE,
            config_value TEXT,
            description VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_config_key (config_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';
        ";
        
        $db->execute($createTableSql);
        echo "✅ system_config 表创建成功\n";
    }
    
    // 检查并添加 API Key 配置
    $apiKeys = [
        'ph8' => [
            'key' => 'api_key_ph8',
            'value' => $_ENV['PH8_API_KEY'] ?? 'sk-2f6ff8aba4d541d591d17e8eae60e75c',
            'description' => 'PH8.co API Key'
        ],
        'gemini' => [
            'key' => 'api_key_gemini',
            'value' => $_ENV['GEMINI_API_KEY'] ?? '',
            'description' => 'Google Gemini API Key'
        ]
    ];
    
    foreach ($apiKeys as $name => $config) {
        echo "\n检查 {$name} API Key...\n";
        
        // 检查是否存在
        $existing = $db->query(
            "SELECT config_value FROM system_config WHERE config_key = ?",
            [$config['key']]
        );
        
        if (empty($existing)) {
            // 不存在，插入
            $db->execute(
                "INSERT INTO system_config (config_key, config_value, description) VALUES (?, ?, ?)",
                [$config['key'], $config['value'], $config['description']]
            );
            echo "✅ 添加 {$name} API Key 成功\n";
        } else {
            // 存在，检查是否需要更新
            if ($existing[0]['config_value'] !== $config['value']) {
                $db->execute(
                    "UPDATE system_config SET config_value = ? WHERE config_key = ?",
                    [$config['value'], $config['key']]
                );
                echo "✅ 更新 {$name} API Key 成功\n";
            } else {
                echo "✅ {$name} API Key 已配置\n";
            }
        }
        
        echo "值: " . ($config['value'] ? substr($config['value'], 0, 20) . '...' : '空') . "\n";
    }
    
    // 检查所有配置
    echo "\n====================================\n";
    echo "当前系统配置:\n";
    $allConfigs = $db->query("SELECT config_key, config_value FROM system_config WHERE config_key LIKE 'api_key_%'");
    foreach ($allConfigs as $config) {
        $value = $config['config_value'] ? substr($config['config_value'], 0, 20) . '...' : '空';
        echo "- {$config['config_key']}: {$value}\n";
    }
    
    echo "\n====================================\n";
    echo "🎉 API Key 配置检查完成！\n";
    echo "如果仍然出现 'apikey is missing' 错误，请检查：\n";
    echo "1. PH8_API_KEY 是否正确（应该是 sk- 开头的字符串）\n";
    echo "2. 网络连接是否正常\n";
    echo "3. PH8.co 服务是否可用\n";
    
} catch (Exception $e) {
    echo "❌ 错误: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
}
