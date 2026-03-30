-- 创建系统配置表
CREATE TABLE IF NOT EXISTS `system_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `config_key` VARCHAR(255) NOT NULL UNIQUE,
  `config_value` TEXT NOT NULL,
  `config_type` VARCHAR(50) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 添加默认配置
INSERT INTO `system_config` (`config_key`, `config_value`, `config_type`, `description`) VALUES
-- 路由配置
('routing.default_strategy', 'stability', 'string', '默认路由策略: stability, price, tier'),
('routing.max_retries', '3', 'number', '最大重试次数'),
('routing.retry_delay_ms', '500', 'number', '重试延迟毫秒'),

-- 系统配置
('system.name', '首席图像架构师', 'string', '系统名称'),
('system.version', '1.0.0', 'string', '系统版本'),
('system.maintenance_mode', 'false', 'boolean', '维护模式'),

-- API 配置
('api.rate_limit.enabled', 'true', 'boolean', '启用速率限制'),
('api.rate_limit.per_minute', '60', 'number', '每分钟请求限制'),

-- 存储配置
('storage.max_file_size', '10485760', 'number', '最大文件大小（字节）'),
('storage.allowed_extensions', '["jpg","jpeg","png","gif","webp"]', 'json', '允许的文件扩展名'),

-- 安全配置
('security.token_expiry', '3600', 'number', '令牌过期时间（秒）'),
('security.password_min_length', '8', 'number', '密码最小长度')
ON DUPLICATE KEY UPDATE `config_value` = VALUES(`config_value`), `config_type` = VALUES(`config_type`), `description` = VALUES(`description`), `updated_at` = NOW();
