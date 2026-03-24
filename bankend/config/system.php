<?php
/**
 * 首席图像架构师 - 系统配置
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

return [
    'app' => [
        'name' => '首席图像架构师',
        'version' => '1.50',
        'company' => '天津匡形无界智能科技有限公司',
        'debug' => $_ENV['APP_DEBUG'] ?? false,
        'timezone' => 'Asia/Shanghai',
    ],
    
    'cors' => [
        'allowed_origins' => ['*'],
        'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'allowed_headers' => ['*'],
        'exposed_headers' => ['Authorization'],
        'max_age' => 86400,
        'supports_credentials' => true,
    ],
    
    'rate_limit' => [
        'enabled' => true,
        'global_rpm' => 1000,
        'user_rpm' => 60,
        'ip_rpm' => 100,
    ],
    
    'cache' => [
        'driver' => 'file',
        'path' => __DIR__ . '/../storage/cache',
        'ttl' => 86400,
    ],
    
    'log' => [
        'enabled' => true,
        'path' => __DIR__ . '/../storage/logs',
        'level' => 'debug',
        'max_files' => 30,
    ],
    
    'security' => [
        'password_algo' => PASSWORD_BCRYPT,
        'password_options' => ['cost' => 12],
        'encryption_key' => $_ENV['ENCRYPTION_KEY'] ?? 'kbit-encryption-key-2026-32-chars!',
    ],
];
