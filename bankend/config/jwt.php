<?php
/**
 * 首席图像架构师 - JWT配置
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

return [
    'secret_key' => $_ENV['JWT_SECRET'] ?? 'kbit-architect-jwt-secret-key-2026-please-change-in-production',
    'algorithm' => 'HS256',
    'issuer' => 'kbitai.com.cn',
    'audience' => 'chief-image-architect',
    
    'access_token' => [
        'ttl' => 3600,
        'leeway' => 60
    ],
    
    'refresh_token' => [
        'ttl' => 604800,
        'leeway' => 300
    ],
    
    'blacklist_enabled' => true,
    'blacklist_grace_period' => 0
];
