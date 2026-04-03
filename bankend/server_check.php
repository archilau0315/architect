<?php
/**
 * 服务器环境检测脚本
 * 用于检查服务器配置和文件状态
 */

echo "=== 服务器环境检测 ===\n\n";

// 1. 检查PHP版本
echo "1. PHP版本检查:\n";
echo "   PHP版本: " . PHP_VERSION . "\n";
echo "   PHP运行方式: " . php_sapi_name() . "\n\n";

// 2. 检查关键文件是否存在
echo "2. 关键文件检查:\n";
$files = [
    'index.php',
    'admin/index.php',
    'admin/dashboard.php',
    '.env',
    'config/database.php',
    'config/jwt.php',
    'includes/Database.php',
    'includes/JWT.php',
    'includes/Router.php',
    'routes/api.php'
];

foreach ($files as $file) {
    $exists = file_exists(__DIR__ . '/' . $file);
    $status = $exists ? '✓ 存在' : '✗ 不存在';
    echo "   {$file}: {$status}\n";
}
echo "\n";

// 3. 检查目录权限
echo "3. 目录权限检查:\n";
$dirs = [
    __DIR__,
    __DIR__ . '/admin',
    __DIR__ . '/config',
    __DIR__ . '/includes',
    __DIR__ . '/models',
    __DIR__ . '/controllers',
    __DIR__ . '/routes',
    __DIR__ . '/storage',
    __DIR__ . '/storage/cache',
    __DIR__ . '/storage/logs'
];

foreach ($dirs as $dir) {
    if (is_dir($dir)) {
        $perms = substr(sprintf('%o', fileperms($dir)), -4);
        $writable = is_writable($dir) ? '可写' : '不可写';
        echo "   {$dir}: {$perms} ({$writable})\n";
    } else {
        echo "   {$dir}: 目录不存在\n";
    }
}
echo "\n";

// 4. 检查文件权限
echo "4. 文件权限检查:\n";
$phpFiles = [
    'index.php',
    'admin/index.php',
    'admin/dashboard.php'
];

foreach ($phpFiles as $file) {
    $filePath = __DIR__ . '/' . $file;
    if (file_exists($filePath)) {
        $perms = substr(sprintf('%o', fileperms($filePath)), -4);
        $readable = is_readable($filePath) ? '可读' : '不可读';
        echo "   {$file}: {$perms} ({$readable})\n";
    } else {
        echo "   {$file}: 文件不存在\n";
    }
}
echo "\n";

// 5. 检查PHP扩展
echo "5. PHP扩展检查:\n";
$extensions = ['pdo', 'pdo_mysql', 'json', 'mbstring', 'openssl', 'curl'];
foreach ($extensions as $ext) {
    $loaded = extension_loaded($ext) ? '✓ 已加载' : '✗ 未加载';
    echo "   {$ext}: {$loaded}\n";
}
echo "\n";

// 6. 检查环境变量
echo "6. 环境变量检查:\n";
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
            // 隐藏敏感信息
            if (strpos($key, 'PASSWORD') !== false || strpos($key, 'SECRET') !== false || strpos($key, 'KEY') !== false) {
                $value = '***';
            }
            echo "   {$key}: {$value}\n";
        }
    }
} else {
    echo "   .env 文件不存在\n";
}
echo "\n";

// 7. 测试数据库连接
echo "7. 数据库连接测试:\n";
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $env = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $env[trim($key)] = trim($value);
        }
    }
    
    $host = $env['DB_HOST'] ?? 'localhost';
    $user = $env['DB_USER'] ?? 'root';
    $pass = $env['DB_PASSWORD'] ?? '';
    $name = $env['DB_NAME'] ?? 'kbitai0302';
    
    try {
        $pdo = new PDO("mysql:host={$host};dbname={$name}", $user, $pass);
        echo "   ✓ 数据库连接成功\n";
        
        // 检查关键表是否存在
        $tables = ['users', 'admins', 'token_usage'];
        foreach ($tables as $table) {
            $stmt = $pdo->query("SHOW TABLES LIKE '{$table}'");
            $exists = $stmt->rowCount() > 0 ? '✓ 存在' : '✗ 不存在';
            echo "   表 {$table}: {$exists}\n";
        }
        
        // 检查管理员用户
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM admins");
        $count = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        echo "   管理员用户数: {$count}\n";
        
    } catch (PDOException $e) {
        echo "   ✗ 数据库连接失败: " . $e->getMessage() . "\n";
    }
} else {
    echo "   无法测试数据库连接（.env文件不存在）\n";
}
echo "\n";

// 8. 检查nginx配置（通过测试访问）
echo "8. Nginx配置测试:\n";
$testUrl = 'http://' . $_SERVER['HTTP_HOST'] . '/test_php_info.php';
echo "   建议创建测试文件 test_php_info.php 并访问测试\n";
echo "\n";

echo "=== 检测完成 ===\n";
