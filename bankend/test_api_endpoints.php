<?php
/**
 * 测试 API 端点
 * 用于验证 API 路由和认证是否正常工作
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/includes/Database.php';
require_once __DIR__ . '/includes/JWT.php';
require_once __DIR__ . '/controllers/AdminController.php';

use KbitArchitect\Core\Database;
use KbitArchitect\Core\JWT;
use KbitArchitect\Controllers\AdminController;

try {
    // 初始化数据库
    $dbConfig = require __DIR__ . '/config/database.php';
    $db = Database::getInstance($dbConfig['default']);
    echo "数据库连接成功\n";
    
    // 初始化 JWT
    $jwtConfig = require __DIR__ . '/config/jwt.php';
    JWT::init($jwtConfig);
    echo "JWT 初始化成功\n";
    
    // 测试管理员登录
    echo "\n测试管理员登录...\n";
    $adminController = new AdminController();
    $loginResult = $adminController->login([
        'body' => [
            'username' => 'admin',
            'password' => 'admin123'
        ],
        'ip' => '127.0.0.1'
    ]);
    
    if ($loginResult['success']) {
        echo "登录成功！\n";
        $token = $loginResult['data']['token'];
        echo "生成的 token: " . substr($token, 0, 50) . "...\n";
        
        // 测试解码 token
        echo "\n测试解码 token...\n";
        try {
            $payload = JWT::decode($token);
            echo "Token 解码成功\n";
            echo "Payload: " . json_encode($payload, JSON_PRETTY_PRINT) . "\n";
        } catch (Exception $e) {
            echo "Token 解码失败: " . $e->getMessage() . "\n";
        }
        
        // 测试 API 端点
        echo "\n测试 API 端点...\n";
        
        // 模拟请求头
        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
        
        // 测试仪表盘 API
        echo "测试仪表盘 API...\n";
        $dashboardResult = $adminController->getDashboard(['query' => []]);
        if ($dashboardResult['success']) {
            echo "仪表盘 API 调用成功\n";
            echo "总用户数: " . $dashboardResult['data']['stats']['total_users'] . "\n";
        } else {
            echo "仪表盘 API 调用失败: " . $dashboardResult['error'] . "\n";
        }
        
        // 测试用户列表 API
        echo "\n测试用户列表 API...\n";
        $usersResult = $adminController->getUsers(['query' => ['page' => 1, 'limit' => 10]]);
        if ($usersResult['success']) {
            echo "用户列表 API 调用成功\n";
            echo "用户数量: " . count($usersResult['data']['users']) . "\n";
        } else {
            echo "用户列表 API 调用失败: " . $usersResult['error'] . "\n";
        }
        
    } else {
        echo "登录失败: " . $loginResult['error'] . "\n";
    }
    
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
    echo "文件: " . $e->getFile() . "\n";
    echo "行号: " . $e->getLine() . "\n";
}

echo "\n测试完成！";
