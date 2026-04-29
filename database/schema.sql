-- ============================================
-- 首席图像架构师 - 数据库架构
-- 版本: 1.0.0
-- 公司: 天津匡形无界智能科技有限公司
-- 创建时间: 2026-03-02
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 1. 用户账户表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL COMMENT '邮箱',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希',
  `nickname` VARCHAR(100) DEFAULT NULL COMMENT '昵称',
  `avatar_url` VARCHAR(500) DEFAULT NULL COMMENT '头像URL',
  `user_tier` ENUM('free', 'basic', 'pro', 'plus') NOT NULL DEFAULT 'free' COMMENT '用户等级',
  `tier_expires_at` DATETIME DEFAULT NULL COMMENT '等级过期时间',
  `daily_points` INT UNSIGNED NOT NULL DEFAULT 100 COMMENT '每日赠送积分',
  `purchased_points` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '永久购买积分',
  `total_consumed_points` DECIMAL(10,2) UNSIGNED NOT NULL DEFAULT 0.00 COMMENT '累计消耗积分',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0=禁用, 1=正常, 2=待验证',
  `email_verified` TINYINT NOT NULL DEFAULT 0 COMMENT '邮箱是否验证',
  `phone_verified` TINYINT NOT NULL DEFAULT 0 COMMENT '手机是否验证',
  `last_login_at` DATETIME DEFAULT NULL COMMENT '最后登录时间',
  `last_login_ip` VARCHAR(45) DEFAULT NULL COMMENT '最后登录IP',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_user_tier` (`user_tier`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户账户表';

-- ============================================
-- 2. 用户等级配置表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_tiers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tier_code` ENUM('free', 'basic', 'pro', 'plus') NOT NULL COMMENT '等级代码',
  `tier_name` VARCHAR(50) NOT NULL COMMENT '等级名称',
  `daily_points` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '每日赠送积分',
  `max_resolution` VARCHAR(20) NOT NULL DEFAULT '1K' COMMENT '最大分辨率',
  `daily_image_limit` INT UNSIGNED NOT NULL DEFAULT 10 COMMENT '每日图像生成限制',
  `daily_video_limit` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '每日视频生成限制',
  `daily_chat_limit` INT UNSIGNED NOT NULL DEFAULT 50 COMMENT '每日聊天限制',
  `monthly_token_quota` INT UNSIGNED NOT NULL DEFAULT 100000 COMMENT '每月Token配额',
  `watermark_free_downloads` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '每日无水印下载次数',
  `features` JSON DEFAULT NULL COMMENT '功能权限配置JSON',
  `price_monthly` DECIMAL(10,2) UNSIGNED NOT NULL DEFAULT 0.00 COMMENT '月费价格',
  `price_quarterly` DECIMAL(10,2) UNSIGNED NOT NULL DEFAULT 0.00 COMMENT '季费价格',
  `price_yearly` DECIMAL(10,2) UNSIGNED NOT NULL DEFAULT 0.00 COMMENT '年费价格',
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '排序',
  `is_active` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tier_code` (`tier_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户等级配置表';

-- [标准化] 用户等级配置初始化 - 系统单一事实来源
INSERT INTO `kbit_tiers` (`tier_code`, `tier_name`, `daily_points`, `max_resolution`, `daily_image_limit`, `daily_video_limit`, `daily_chat_limit`, `monthly_token_quota`, `watermark_free_downloads`, `features`, `price_monthly`, `price_quarterly`, `price_yearly`, `sort_order`) VALUES
('free', '免费用户', 200, '1K', 10, 0, 50, 6000, 0, '{"video": false, "hd_download": false, "priority_support": false}', 0.00, 0.00, 0.00, 1),
('basic', '基础级', 400, '2K', 50, 5, 200, 12000, 10, '{"video": true, "hd_download": true, "priority_support": false}', 0.00, 0.00, 0.00, 2),
('pro', 'PRO级', 1500, '4K', 200, 16, 500, 45000, 50, '{"video": true, "hd_download": true, "priority_support": true}', 0.00, 0.00, 0.00, 3),
('plus', 'PLUS级', 2000, '4K', 999, 50, 999, 60000, 999, '{"video": true, "hd_download": true, "priority_support": true, "api_access": true}', 0.00, 0.00, 0.00, 4);

-- ============================================
-- 3. 订阅记录表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_subscriptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `tier_code` ENUM('free', 'basic', 'pro', 'plus') NOT NULL COMMENT '订阅等级',
  `billing_cycle` ENUM('monthly', 'quarterly', 'yearly') NOT NULL COMMENT '计费周期',
  `amount` DECIMAL(10,2) UNSIGNED NOT NULL COMMENT '支付金额',
  `currency` VARCHAR(10) NOT NULL DEFAULT 'CNY' COMMENT '货币',
  `status` ENUM('pending', 'active', 'cancelled', 'expired', 'refunded') NOT NULL DEFAULT 'pending' COMMENT '订阅状态',
  `payment_method` VARCHAR(50) DEFAULT NULL COMMENT '支付方式',
  `payment_transaction_id` VARCHAR(100) DEFAULT NULL COMMENT '支付交易ID',
  `started_at` DATETIME NOT NULL COMMENT '开始时间',
  `expires_at` DATETIME NOT NULL COMMENT '过期时间',
  `cancelled_at` DATETIME DEFAULT NULL COMMENT '取消时间',
  `auto_renew` TINYINT NOT NULL DEFAULT 1 COMMENT '是否自动续费',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `fk_subscriptions_user` FOREIGN KEY (`user_id`) REFERENCES `kbit_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订阅记录表';

-- ============================================
-- 4. 积分交易流水表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `type` ENUM('earn', 'spend', 'refund', 'purchase', 'gift', 'expire') NOT NULL COMMENT '交易类型',
  `amount` DECIMAL(10,2) NOT NULL COMMENT '交易金额(正数为获得,负数为消耗)',
  `balance_before` DECIMAL(10,2) UNSIGNED NOT NULL COMMENT '交易前余额',
  `balance_after` DECIMAL(10,2) UNSIGNED NOT NULL COMMENT '交易后余额',
  `source` VARCHAR(50) NOT NULL COMMENT '来源: daily_reset, image_gen, video_gen, chat, purchase, refund, admin_adjust',
  `reference_id` VARCHAR(100) DEFAULT NULL COMMENT '关联ID(订单号/请求ID等)',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '交易描述',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_source` (`source`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `kbit_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分交易流水表';

-- ============================================
-- 5. AI模型配置表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_models` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `model_id` VARCHAR(100) NOT NULL COMMENT '模型ID',
  `model_name` VARCHAR(100) NOT NULL COMMENT '模型名称',
  `model_type` ENUM('text', 'image', 'video', 'multimodal') NOT NULL COMMENT '模型类型',
  `provider` VARCHAR(50) NOT NULL COMMENT '提供商: google, openai, deepseek, custom',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '模型描述',
  `input_price` DECIMAL(10,6) UNSIGNED NOT NULL DEFAULT 0.00 COMMENT '输入价格(每1K tokens)',
  `output_price` DECIMAL(10,6) UNSIGNED NOT NULL DEFAULT 0.00 COMMENT '输出价格(每1K tokens)',
  `image_price` DECIMAL(10,2) UNSIGNED NOT NULL DEFAULT 0.00 COMMENT '图像生成价格(每次)',
  `video_price` DECIMAL(10,2) UNSIGNED NOT NULL DEFAULT 0.00 COMMENT '视频生成价格(每次)',
  `max_tokens` INT UNSIGNED NOT NULL DEFAULT 8192 COMMENT '最大Token数',
  `supports_vision` TINYINT NOT NULL DEFAULT 0 COMMENT '是否支持视觉',
  `supports_streaming` TINYINT NOT NULL DEFAULT 1 COMMENT '是否支持流式',
  `stability_score` DECIMAL(3,2) UNSIGNED NOT NULL DEFAULT 0.90 COMMENT '稳定性评分(0-1)',
  `avg_latency_ms` INT UNSIGNED NOT NULL DEFAULT 1000 COMMENT '平均延迟(毫秒)',
  `min_tier` ENUM('free', 'basic', 'pro', 'plus') NOT NULL DEFAULT 'free' COMMENT '最低使用等级',
  `is_active` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_model_id` (`model_id`),
  KEY `idx_model_type` (`model_type`),
  KEY `idx_provider` (`provider`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI模型配置表';

-- 初始化模型配置
INSERT INTO `kbit_models` (`model_id`, `model_name`, `model_type`, `provider`, `description`, `input_price`, `output_price`, `image_price`, `video_price`, `max_tokens`, `supports_vision`, `stability_score`, `avg_latency_ms`, `min_tier`, `sort_order`) VALUES
('gemini-2.5-flash', 'Gemini 2.5 Flash', 'multimodal', 'google', '快速多模态模型', 0.000075, 0.000300, 0.00, 0.00, 1048576, 1, 0.95, 800, 'free', 1),
('gemini-3-flash-preview', 'Gemini 3 Flash Preview', 'multimodal', 'google', '新一代快速模型', 0.000100, 0.000400, 0.00, 0.00, 1048576, 1, 0.92, 1000, 'basic', 2),
('gemini-3-pro-preview', 'Gemini 3 Pro Preview', 'multimodal', 'google', '新一代高级模型', 0.000175, 0.000700, 0.00, 0.00, 1048576, 1, 0.98, 2000, 'pro', 3),
('gemini-2.5-flash-image', 'Gemini 2.5 Flash Image', 'image', 'google', '图像生成模型', 0.000000, 0.000000, 0.05, 0.00, 8192, 1, 0.93, 3000, 'free', 10),
('gemini-3.1-flash-image-preview', 'Gemini 3.1 Flash Image', 'image', 'google', '新一代图像模型', 0.000000, 0.000000, 0.08, 0.00, 8192, 1, 0.90, 3500, 'basic', 11),
('gemini-3-pro-image-preview', 'Gemini 3 Pro Image', 'image', 'google', '高级图像模型', 0.000000, 0.000000, 0.15, 0.00, 8192, 1, 0.95, 5000, 'pro', 12),
('veo-3.1-fast-generate-preview', 'Veo 3.1 Fast', 'video', 'google', '快速视频生成', 0.000000, 0.000000, 0.00, 0.50, 8192, 0, 0.85, 30000, 'basic', 20),
('veo-3.1-generate-preview', 'Veo 3.1 Standard', 'video', 'google', '标准视频生成', 0.000000, 0.000000, 0.00, 1.00, 8192, 0, 0.90, 60000, 'pro', 21),
('deepseek-v3.2', 'DeepSeek V3.2', 'text', 'deepseek', '高性价比文本模型', 0.000014, 0.000028, 0.00, 0.00, 65536, 0, 0.88, 500, 'free', 30);

-- ============================================
-- 6. 服务渠道配置表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_channels` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `channel_id` VARCHAR(50) NOT NULL COMMENT '渠道ID',
  `channel_name` VARCHAR(100) NOT NULL COMMENT '渠道名称',
  `provider` VARCHAR(50) NOT NULL COMMENT '提供商',
  `base_url` VARCHAR(255) NOT NULL COMMENT 'API基础URL',
  `api_key_encrypted` TEXT DEFAULT NULL COMMENT '加密的API Key',
  `models_supported` JSON NOT NULL COMMENT '支持的模型列表',
  `priority` INT UNSIGNED NOT NULL DEFAULT 100 COMMENT '优先级(越高越优先)',
  `weight` INT UNSIGNED NOT NULL DEFAULT 100 COMMENT '权重(负载均衡用)',
  `status` ENUM('active', 'inactive', 'maintenance', 'error') NOT NULL DEFAULT 'active' COMMENT '渠道状态',
  `success_rate` DECIMAL(5,2) UNSIGNED NOT NULL DEFAULT 99.00 COMMENT '成功率(%)',
  `avg_latency_ms` INT UNSIGNED NOT NULL DEFAULT 1000 COMMENT '平均延迟',
  `total_requests` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '总请求数',
  `failed_requests` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '失败请求数',
  `last_error_at` DATETIME DEFAULT NULL COMMENT '最后错误时间',
  `last_error_msg` VARCHAR(500) DEFAULT NULL COMMENT '最后错误信息',
  `rate_limit_rpm` INT UNSIGNED NOT NULL DEFAULT 60 COMMENT '每分钟请求限制',
  `rate_limit_tpm` INT UNSIGNED NOT NULL DEFAULT 100000 COMMENT '每分钟Token限制',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_channel_id` (`channel_id`),
  KEY `idx_provider` (`provider`),
  KEY `idx_status` (`status`),
  KEY `idx_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务渠道配置表';

-- 初始化渠道配置
INSERT INTO `kbit_channels` (`channel_id`, `channel_name`, `provider`, `base_url`, `models_supported`, `priority`, `weight`, `status`, `success_rate`, `avg_latency_ms`) VALUES
('google-official', 'Google官方直连', 'google', 'https://generativelanguage.googleapis.com', '["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-2.5-flash-image", "gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview", "veo-3.1-fast-generate-preview", "veo-3.1-generate-preview"]', 100, 100, 'active', 99.50, 1200),
('hp8-accelerator', 'HP8加速节点', 'hp8', 'https://ph8.co/openai/v1', '["gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview", "veo-3.1-fast-generate-preview", "veo-3.1-generate-preview", "deepseek-v3.2"]', 200, 150, 'active', 98.00, 800),
('backup-proxy-a', '备用代理A', 'proxy', 'https://api.proxy-a.com', '["gemini-2.5-flash", "gemini-3-flash-preview"]', 50, 50, 'active', 95.00, 1500),
('backup-proxy-b', '备用代理B', 'proxy', 'https://api.proxy-b.com', '["gemini-2.5-flash", "deepseek-v3.2"]', 30, 30, 'inactive', 90.00, 2000);

-- ============================================
-- 7. 路由规则表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_routing_rules` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `rule_name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `rule_type` ENUM('price', 'stability', 'tier', 'custom') NOT NULL COMMENT '路由类型',
  `model_type` ENUM('text', 'image', 'video', 'multimodal', 'all') NOT NULL DEFAULT 'all' COMMENT '适用模型类型',
  `user_tier` ENUM('free', 'basic', 'pro', 'plus', 'all') NOT NULL DEFAULT 'all' COMMENT '适用用户等级',
  `preferred_models` JSON DEFAULT NULL COMMENT '首选模型列表',
  `fallback_models` JSON DEFAULT NULL COMMENT '降级模型列表',
  `preferred_channels` JSON DEFAULT NULL COMMENT '首选渠道列表',
  `fallback_channels` JSON DEFAULT NULL COMMENT '降级渠道列表',
  `max_cost_per_request` DECIMAL(10,4) UNSIGNED DEFAULT NULL COMMENT '单次请求最大成本',
  `priority` INT UNSIGNED NOT NULL DEFAULT 100 COMMENT '规则优先级',
  `is_active` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rule_type` (`rule_type`),
  KEY `idx_model_type` (`model_type`),
  KEY `idx_user_tier` (`user_tier`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='路由规则表';

-- 初始化路由规则
INSERT INTO `kbit_routing_rules` (`rule_name`, `rule_type`, `model_type`, `user_tier`, `preferred_models`, `fallback_models`, `preferred_channels`, `priority`) VALUES
('免费用户-价格优先', 'price', 'all', 'free', '["gemini-2.5-flash", "deepseek-v3.2"]', '["gemini-2.5-flash"]', '["google-official", "hp8-accelerator"]', 100),
('基础用户-均衡模式', 'stability', 'all', 'basic', '["gemini-3-flash-preview", "gemini-2.5-flash-image"]', '["gemini-2.5-flash"]', '["hp8-accelerator", "google-official"]', 100),
('PRO用户-质量优先', 'tier', 'all', 'pro', '["gemini-3-pro-preview", "gemini-3-pro-image-preview"]', '["gemini-3-flash-preview"]', '["hp8-accelerator", "google-official"]', 100),
('PLUS用户-顶级配置', 'tier', 'all', 'plus', '["gemini-3-pro-preview", "gemini-3-pro-image-preview", "veo-3.1-generate-preview"]', '["gemini-3-flash-preview"]', '["hp8-accelerator", "google-official"]', 100),
('图像生成-价格优先', 'price', 'image', 'all', '["gemini-2.5-flash-image"]', '[]', '["google-official", "hp8-accelerator"]', 150),
('视频生成-稳定性优先', 'stability', 'video', 'all', '["veo-3.1-generate-preview"]', '["veo-3.1-fast-generate-preview"]', '["google-official", "hp8-accelerator"]', 150);

-- ============================================
-- 8. 使用日志表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_usage_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `request_id` VARCHAR(50) NOT NULL COMMENT '请求ID',
  `feature` ENUM('image_gen', 'video_gen', 'chat', 'image_analyze', 'prompt_enhance') NOT NULL COMMENT '使用功能',
  `model_id` VARCHAR(100) NOT NULL COMMENT '使用的模型',
  `channel_id` VARCHAR(50) NOT NULL COMMENT '使用的渠道',
  `routing_strategy` VARCHAR(20) DEFAULT NULL COMMENT '路由策略',
  `prompt_tokens` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '输入Token数',
  `completion_tokens` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '输出Token数',
  `total_tokens` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '总Token数',
  `points_cost` DECIMAL(10,2) UNSIGNED NOT NULL DEFAULT 0.00 COMMENT '消耗积分',
  `actual_cost` DECIMAL(10,6) UNSIGNED NOT NULL DEFAULT 0.000000 COMMENT '实际成本(USD)',
  `image_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '生成图像数',
  `video_duration` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '视频时长(秒)',
  `resolution` VARCHAR(20) DEFAULT NULL COMMENT '分辨率',
  `status` ENUM('success', 'failed', 'timeout', 'cancelled') NOT NULL DEFAULT 'success' COMMENT '状态',
  `error_message` VARCHAR(500) DEFAULT NULL COMMENT '错误信息',
  `latency_ms` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '响应延迟(毫秒)',
  `ip_address` VARCHAR(45) NOT NULL COMMENT '客户端IP',
  `user_agent` VARCHAR(500) DEFAULT NULL COMMENT '用户代理',
  `request_hash` VARCHAR(64) DEFAULT NULL COMMENT '请求哈希(用于缓存)',
  `cache_hit` TINYINT NOT NULL DEFAULT 0 COMMENT '是否命中缓存',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_request_id` (`request_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_feature` (`feature`),
  KEY `idx_model_id` (`model_id`),
  KEY `idx_channel_id` (`channel_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_request_hash` (`request_hash`),
  CONSTRAINT `fk_usage_logs_user` FOREIGN KEY (`user_id`) REFERENCES `kbit_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='使用日志表';

-- ============================================
-- 9. 系统配置表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_system_config` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
  `config_value` TEXT NOT NULL COMMENT '配置值',
  `config_type` ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string' COMMENT '配置类型',
  `category` VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT '配置分类',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '配置描述',
  `is_public` TINYINT NOT NULL DEFAULT 0 COMMENT '是否公开给前端',
  `updated_by` BIGINT UNSIGNED DEFAULT NULL COMMENT '更新者ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 初始化系统配置
INSERT INTO `kbit_system_config` (`config_key`, `config_value`, `config_type`, `category`, `description`, `is_public`) VALUES
('system.name', '首席图像架构师', 'string', 'general', '系统名称', 1),
('system.version', '1.50', 'string', 'general', '系统版本', 1),
('system.company', '天津匡形无界智能科技有限公司', 'string', 'general', '运营主体', 1),
('routing.default_strategy', 'stability', 'string', 'routing', '默认路由策略: price/stability/tier', 0),
('routing.cache_ttl', '3600', 'number', 'routing', '路由缓存时间(秒)', 0),
('quota.enable_prededuct', 'true', 'boolean', 'quota', '是否启用预扣机制', 0),
('quota.refund_on_failure', 'true', 'boolean', 'quota', '失败时是否退还积分', 0),
('ratelimit.global_rpm', '1000', 'number', 'security', '全局每分钟请求限制', 0),
('ratelimit.user_rpm', '60', 'number', 'security', '用户每分钟请求限制', 0),
('ratelimit.enable_antibot', 'true', 'boolean', 'security', '是否启用防刷机制', 0),
('budget.daily_limit', '1000.00', 'number', 'budget', '每日成本上限(USD)', 0),
('budget.monthly_limit', '20000.00', 'number', 'budget', '每月成本上限(USD)', 0),
('budget.enable_circuit_breaker', 'true', 'boolean', 'budget', '是否启用熔断机制', 0),
('budget.fallback_model', 'gemini-2.5-flash', 'string', 'budget', '熔断后降级模型', 0),
('cache.enable_response_cache', 'true', 'boolean', 'cache', '是否启用响应缓存', 0),
('cache.ttl_seconds', '86400', 'number', 'cache', '缓存有效期(秒)', 0),
('points.image_1k', '10', 'number', 'points', '1K图像消耗积分', 1),
('points.image_2k', '15', 'number', 'points', '2K图像消耗积分', 1),
('points.image_4k', '25', 'number', 'points', '4K图像消耗积分', 1),
('points.video_standard', '50', 'number', 'points', '标准视频消耗积分', 1),
('points.video_hd', '100', 'number', 'points', '高清视频消耗积分', 1),
('points.chat_1k_tokens', '1', 'number', 'points', '聊天每1K Token消耗积分', 1),
-- API Key配置（存储在后端，不暴露给前端，部署时请填入真实值）
('api_key_ph8', '', 'string', 'api_keys', 'ph8网关API Key', 0),
('api_key_google', '', 'string', 'api_keys', 'Google官方API Key', 0);

-- ============================================
-- 10. 限流规则表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_rate_limits` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `rule_name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `rule_type` ENUM('ip', 'user', 'global', 'feature') NOT NULL COMMENT '限流类型',
  `feature` ENUM('image_gen', 'video_gen', 'chat', 'image_analyze', 'prompt_enhance', 'all') NOT NULL DEFAULT 'all' COMMENT '适用功能',
  `user_tier` ENUM('free', 'basic', 'pro', 'plus', 'all') NOT NULL DEFAULT 'all' COMMENT '适用用户等级',
  `max_requests` INT UNSIGNED NOT NULL COMMENT '最大请求数',
  `window_seconds` INT UNSIGNED NOT NULL COMMENT '时间窗口(秒)',
  `action` ENUM('reject', 'queue', 'degrade') NOT NULL DEFAULT 'reject' COMMENT '超限处理',
  `degrade_model` VARCHAR(100) DEFAULT NULL COMMENT '降级模型',
  `is_active` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rule_type` (`rule_type`),
  KEY `idx_feature` (`feature`),
  KEY `idx_user_tier` (`user_tier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='限流规则表';

-- 初始化限流规则
INSERT INTO `kbit_rate_limits` (`rule_name`, `rule_type`, `feature`, `user_tier`, `max_requests`, `window_seconds`, `action`, `degrade_model`) VALUES
('全局限流', 'global', 'all', 'all', 1000, 60, 'reject', NULL),
('免费用户-图像生成', 'user', 'image_gen', 'free', 10, 3600, 'reject', NULL),
('基础用户-图像生成', 'user', 'image_gen', 'basic', 50, 3600, 'queue', NULL),
('PRO用户-图像生成', 'user', 'image_gen', 'pro', 200, 3600, 'queue', NULL),
('免费用户-视频生成', 'user', 'video_gen', 'free', 0, 3600, 'reject', NULL),
('基础用户-视频生成', 'user', 'video_gen', 'basic', 5, 86400, 'queue', NULL),
('PRO用户-视频生成', 'user', 'video_gen', 'pro', 16, 86400, 'queue', NULL),
('IP限流-防刷', 'ip', 'all', 'all', 100, 60, 'reject', NULL);

-- ============================================
-- 11. 响应缓存表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_cache_entries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cache_key` VARCHAR(64) NOT NULL COMMENT '缓存键(MD5)',
  `cache_value` LONGTEXT NOT NULL COMMENT '缓存值',
  `request_hash` VARCHAR(64) NOT NULL COMMENT '请求哈希',
  `model_id` VARCHAR(100) NOT NULL COMMENT '使用的模型',
  `feature` VARCHAR(50) NOT NULL COMMENT '功能类型',
  `hit_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '命中次数',
  `last_hit_at` DATETIME DEFAULT NULL COMMENT '最后命中时间',
  `expires_at` DATETIME NOT NULL COMMENT '过期时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cache_key` (`cache_key`),
  KEY `idx_request_hash` (`request_hash`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_feature` (`feature`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='响应缓存表';

-- ============================================
-- 12. 管理员表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_admins` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希',
  `nickname` VARCHAR(100) DEFAULT NULL COMMENT '昵称',
  `email` VARCHAR(255) DEFAULT NULL COMMENT '邮箱',
  `role` ENUM('super_admin', 'admin', 'operator', 'viewer') NOT NULL DEFAULT 'operator' COMMENT '角色',
  `permissions` JSON DEFAULT NULL COMMENT '权限列表',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0=禁用, 1=正常',
  `last_login_at` DATETIME DEFAULT NULL COMMENT '最后登录时间',
  `last_login_ip` VARCHAR(45) DEFAULT NULL COMMENT '最后登录IP',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';

-- 初始化超级管理员 (密码: admin123, 请及时修改)
INSERT INTO `kbit_admins` (`username`, `password_hash`, `nickname`, `email`, `role`, `permissions`) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '超级管理员', 'kbit_ai@126.com', 'super_admin', '["all"]');

-- ============================================
-- 13. JWT Token 黑名单表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_token_blacklist` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token_jti` VARCHAR(64) NOT NULL COMMENT 'Token JTI',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `reason` VARCHAR(100) DEFAULT NULL COMMENT '失效原因',
  `expires_at` DATETIME NOT NULL COMMENT 'Token原过期时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_jti` (`token_jti`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='JWT Token黑名单表';

-- ============================================
-- 14. 验证码表
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_verification_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `target` VARCHAR(255) NOT NULL COMMENT '目标(邮箱/手机)',
  `code` VARCHAR(10) NOT NULL COMMENT '验证码',
  `type` ENUM('email', 'phone', 'password_reset') NOT NULL COMMENT '类型',
  `is_used` TINYINT NOT NULL DEFAULT 0 COMMENT '是否已使用',
  `expires_at` DATETIME NOT NULL COMMENT '过期时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_target` (`target`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='验证码表';

-- ============================================
-- 索引优化与清理
-- ============================================

-- 创建定时清理过期缓存的存储过程
DELIMITER //
CREATE PROCEDURE `sp_clean_expired_cache`()
BEGIN
    DELETE FROM `kbit_cache_entries` WHERE `expires_at` < NOW();
    DELETE FROM `kbit_token_blacklist` WHERE `expires_at` < NOW();
    DELETE FROM `kbit_verification_codes` WHERE `expires_at` < NOW();
END //
DELIMITER ;

-- 创建每日积分重置的存储过程
DELIMITER //
CREATE PROCEDURE `sp_reset_daily_points`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_user_id BIGINT;
    DECLARE v_tier_code VARCHAR(20);
    DECLARE v_daily_points INT;
    
    DECLARE cur CURSOR FOR 
        SELECT u.id, u.user_tier, t.daily_points 
        FROM kbit_users u 
        JOIN kbit_tiers t ON u.user_tier = t.tier_code 
        WHERE u.status = 1;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO v_user_id, v_tier_code, v_daily_points;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        UPDATE kbit_users SET daily_points = v_daily_points WHERE id = v_user_id;
        
        INSERT INTO kbit_transactions (user_id, type, amount, balance_before, balance_after, source, description)
        SELECT v_user_id, 'earn', v_daily_points, daily_points - v_daily_points, daily_points, 'daily_reset', '每日积分重置'
        FROM kbit_users WHERE id = v_user_id;
    END LOOP;
    
    CLOSE cur;
END //
DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- 完成提示
-- ============================================
SELECT '数据库架构创建完成!' AS message;
SELECT COUNT(*) AS tables_count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'kbit_%';
