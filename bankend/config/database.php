<?php
/**
 * 首席图像架构师 - 数据库配置
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

return [
    'default' => [
        'host' => $_ENV['DB_HOST'] ?? 'localhost',
        'port' => $_ENV['DB_PORT'] ?? 3306,
        'database' => $_ENV['DB_DATABASE'] ?? 'kbitai0302',
        'username' => $_ENV['DB_USERNAME'] ?? 'kbitai0302',
        'password' => $_ENV['DB_PASSWORD'] ?? 'kbitai2026',
        'charset' => 'utf8mb4',
        'collation' => 'utf8mb4_unicode_ci',
        'prefix' => '',
        'options' => [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
        ]
    ]
];
