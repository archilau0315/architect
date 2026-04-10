<?php
/**
 * 测试管理员后台修复
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

date_default_timezone_set('Asia/Shanghai');

// 加载必要的文件
require_once __DIR__ . '/includes/Database.php';
require_once __DIR__ . '/includes/JWT.php';
require_once __DIR__ . '/controllers/AdminController.php';

use KbitArchitect\Core\Database;
use KbitArchitect\Core\JWT;
use KbitArchitect\Controllers\AdminController;

echo "开始测试管理员后台修复 ====================================\n";

try {
    // 加载配置
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

    // 初始化数据库
    $dbConfig = [
        'host' => $_ENV['DB_HOST'] ?? 'localhost',
        'port' => $_ENV['DB_PORT'] ?? 3306,
        'database' => $_ENV['DB_DATABASE'] ?? 'kbitai0302',
        'username' => $_ENV['DB_USERNAME'] ?? 'kbitai0302',
        'password' => $_ENV['DB_PASSWORD'] ?? 'kbitai2026',
        'charset' => 'utf8mb4',
        'collation' => 'utf8mb4_unicode_ci',
        'prefix' => ''
    ];

    $db = Database::getInstance($dbConfig);
    echo "✓ 数据库连接成功\n";

    // 测试 admins 表结构
    $adminColumns = $db->query('SHOW COLUMNS FROM admins');
    $requiredColumns = ['id', 'username', 'password_hash', 'role', 'created_at', 'updated_at', 'last_login_at', 'last_login_ip'];
    $missingColumns = [];

    foreach ($requiredColumns as $column) {
        $found = false;
        foreach ($adminColumns as $col) {
            if ($col['Field'] === $column) {
                $found = true;
                break;
            }
        }
        if (!$found) {
            $missingColumns[] = $column;
        }
    }

    if (empty($missingColumns)) {
        echo "✓ admins 表结构完整\n";
    } else {
        echo "✗ admins 表缺少字段: " . implode(', ', $missingColumns) . "\n";
    }

    // 测试管理员数据
    $adminCount = $db->queryOne('SELECT COUNT(*) as count FROM admins');
    echo "管理员数据行数: " . ($adminCount['count'] ?? 0) . "\n";

    if ($adminCount['count'] > 0) {
        $admin = $db->queryOne('SELECT * FROM admins WHERE username = ?', ['admin']);
        if ($admin) {
            echo "✓ 默认管理员存在\n";
            echo "  用户名: " . $admin['username'] . "\n";
            echo "  角色: " . $admin['role'] . "\n";
        } else {
            echo "✗ 默认管理员不存在\n";
        }
    }

    // 测试 beta_applications 表
    $betaColumns = $db->query('SHOW COLUMNS FROM beta_applications');
    $betaRequiredColumns = ['id', 'name', 'email', 'phone', 'company', 'purpose', 'experience', 'applied_at', 'status', 'approved_at'];
    $betaMissingColumns = [];

    foreach ($betaRequiredColumns as $column) {
        $found = false;
        foreach ($betaColumns as $col) {
            if ($col['Field'] === $column) {
                $found = true;
                break;
            }
        }
        if (!$found) {
            $betaMissingColumns[] = $column;
        }
    }

    if (empty($betaMissingColumns)) {
        echo "✓ beta_applications 表结构完整\n";
    } else {
        echo "✗ beta_applications 表缺少字段: " . implode(', ', $betaMissingColumns) . "\n";
    }

    // 测试登录功能
    echo "\n测试登录功能:\n";
    $adminController = new AdminController();
    $loginRequest = [
        'body' => [
            'username' => 'admin',
            'password' => 'admin123'
        ],
        'ip' => '127.0.0.1'
    ];

    $loginResult = $adminController->login($loginRequest);
    if ($loginResult['success']) {
        echo "🎉🎉🎉 登录成功！🎉🎉🎉\n";
        echo "管理员信息: - ID: " . $loginResult['data']['admin']['id'] . " - 用户名: " . $loginResult['data']['admin']['username'] . " - 角色: " . $loginResult['data']['admin']['role'] . "\n";
        echo "Token 已生成（前50字符）: " . substr($loginResult['data']['token'], 0, 50) . "...\n";
    } else {
        echo "✗ 登录失败: " . $loginResult['error'] . "\n";
    }

} catch (Exception $e) {
    echo "✗ 测试失败: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
}

echo "==================================== 测试完成\n";
