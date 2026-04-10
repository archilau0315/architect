-- 修复数据库表字段与代码不匹配问题
-- 执行日期: 2026-04-09
-- 说明: 统一字段命名，确保与代码一致

USE kbitai0302;

-- 1. 修改 kbit_users 表字段名
ALTER TABLE kbit_users
  -- 修改 tier 为 user_tier
  CHANGE COLUMN `tier` `user_tier` ENUM('free', 'beta', 'basic', 'pro', 'plus') DEFAULT 'free' COMMENT '用户等级',

  -- 修改 total_points 为 daily_points
  CHANGE COLUMN `total_points` `daily_points` INT DEFAULT 0 COMMENT '每日积分',

  -- 添加 purchased_points 字段（如果不存在）
  ADD COLUMN IF NOT EXISTS `purchased_points` INT DEFAULT 0 COMMENT '购买积分' AFTER `daily_points`,

  -- 添加 total_consumed_points 字段（如果不存在）
  ADD COLUMN IF NOT EXISTS `total_consumed_points` INT DEFAULT 0 COMMENT '累计消耗积分' AFTER `purchased_points`,

  -- 添加 tier_expires_at 字段（如果不存在）
  ADD COLUMN IF NOT EXISTS `tier_expires_at` TIMESTAMP NULL COMMENT '等级过期时间' AFTER `user_tier`,

  -- 添加 avatar_url 字段（如果不存在）
  ADD COLUMN IF NOT EXISTS `avatar_url` VARCHAR(255) COMMENT '头像URL' AFTER `nickname`,

  -- 添加 email_verified 字段（如果不存在）
  ADD COLUMN IF NOT EXISTS `email_verified` TINYINT(1) DEFAULT 0 COMMENT '邮箱是否验证' AFTER `email`,

  -- 添加 phone_verified 字段（如果不存在）
  ADD COLUMN IF NOT EXISTS `phone_verified` TINYINT(1) DEFAULT 0 COMMENT '手机是否验证' AFTER `phone`,

  -- 添加 last_login_ip 字段（如果不存在）
  ADD COLUMN IF NOT EXISTS `last_login_ip` VARCHAR(45) COMMENT '最后登录IP' AFTER `last_login_at`;

-- 2. 删除旧的 daily_quota 和 daily_used 字段（如果存在）
ALTER TABLE kbit_users
  DROP COLUMN IF EXISTS `daily_quota`,
  DROP COLUMN IF EXISTS `daily_used`,
  DROP COLUMN IF EXISTS `last_reset_date`;

-- 3. 确保索引正确
ALTER TABLE kbit_users
  ADD INDEX IF NOT EXISTS `idx_user_tier` (`user_tier`),
  ADD INDEX IF NOT EXISTS `idx_email_verified` (`email_verified`);

-- 4. 创建 transactions 表（如果不存在）
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL COMMENT '用户ID',
  `type` ENUM('earn', 'spend', 'purchase', 'refund', 'bonus') NOT NULL COMMENT '交易类型',
  `amount` DECIMAL(10,2) NOT NULL COMMENT '金额',
  `balance_before` DECIMAL(10,2) DEFAULT 0 COMMENT '交易前余额',
  `balance_after` DECIMAL(10,2) DEFAULT 0 COMMENT '交易后余额',
  `source` VARCHAR(64) COMMENT '来源',
  `reference_id` VARCHAR(128) COMMENT '关联ID',
  `description` TEXT COMMENT '描述',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交易记录表';

-- 5. 创建 token_usage 表（如果不存在）
CREATE TABLE IF NOT EXISTS `token_usage` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL COMMENT '用户ID',
  `request_type` VARCHAR(32) COMMENT '请求类型',
  `model_name` VARCHAR(64) COMMENT '模型名称',
  `prompt_tokens` INT DEFAULT 0 COMMENT '输入Token数',
  `completion_tokens` INT DEFAULT 0 COMMENT '输出Token数',
  `total_tokens` INT DEFAULT 0 COMMENT '总Token数',
  `status` VARCHAR(16) DEFAULT 'success' COMMENT '状态',
  `error_message` TEXT COMMENT '错误信息',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_request_type` (`request_type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Token使用记录表';

-- 6. 创建 tiers 表（如果不存在）
CREATE TABLE IF NOT EXISTS `tiers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tier_code` VARCHAR(16) UNIQUE NOT NULL COMMENT '等级代码',
  `tier_name` VARCHAR(64) NOT NULL COMMENT '等级名称',
  `daily_image_limit` INT DEFAULT 0 COMMENT '每日图像生成限制',
  `daily_video_limit` INT DEFAULT 0 COMMENT '每日视频生成限制',
  `daily_chat_limit` INT DEFAULT 0 COMMENT '每日对话限制',
  `max_resolution` VARCHAR(8) DEFAULT '1K' COMMENT '最大分辨率',
  `watermark_free_downloads` INT DEFAULT 0 COMMENT '无水印下载次数',
  `features` JSON COMMENT '功能列表',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tier_code` (`tier_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户等级配置表';

-- 7. 插入默认等级配置
INSERT INTO `tiers` (`tier_code`, `tier_name`, `daily_image_limit`, `daily_video_limit`, `daily_chat_limit`, `max_resolution`, `watermark_free_downloads`, `features`) VALUES
('free', '免费用户', 10, 0, 100, '1K', 0, '{"chat": true, "image_gen": true, "video_gen": false}'),
('beta', '内测用户', 50, 5, 200, '2K', 0, '{"chat": true, "image_gen": true, "video_gen": true, "priority_support": true}'),
('basic', '基础级', 100, 10, 500, '2K', 5, '{"chat": true, "image_gen": true, "video_gen": true}'),
('pro', 'PRO级', 300, 30, 1000, '4K', 20, '{"chat": true, "image_gen": true, "video_gen": true, "priority_support": true}'),
('plus', 'PLUS级', 999999, 999999, 999999, '4K', 999999, '{"chat": true, "image_gen": true, "video_gen": true, "priority_support": true, "api_access": true}')
ON DUPLICATE KEY UPDATE
  `tier_name` = VALUES(`tier_name`),
  `daily_image_limit` = VALUES(`daily_image_limit`),
  `daily_video_limit` = VALUES(`daily_video_limit`),
  `daily_chat_limit` = VALUES(`daily_chat_limit`),
  `max_resolution` = VALUES(`max_resolution`),
  `watermark_free_downloads` = VALUES(`watermark_free_downloads`),
  `features` = VALUES(`features`);

-- 8. 创建 system_config 表（如果不存在）
CREATE TABLE IF NOT EXISTS `system_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `config_key` VARCHAR(64) UNIQUE NOT NULL COMMENT '配置键',
  `config_value` TEXT COMMENT '配置值',
  `config_type` ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string' COMMENT '配置类型',
  `is_public` TINYINT(1) DEFAULT 0 COMMENT '是否公开',
  `description` VARCHAR(255) COMMENT '描述',
  `updated_by` VARCHAR(64) COMMENT '更新者',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 9. 插入默认系统配置
INSERT INTO `system_config` (`config_key`, `config_value`, `config_type`, `is_public`, `description`) VALUES
('quota.enable_prededuct', 'true', 'boolean', 0, '是否启用预扣'),
('quota.refund_on_failure', 'true', 'boolean', 0, '失败时是否退款'),
('points.image_1k', '10', 'number', 1, '1K图像生成积分'),
('points.image_2k', '15', 'number', 1, '2K图像生成积分'),
('points.image_4k', '25', 'number', 1, '4K图像生成积分'),
('points.video_standard', '50', 'number', 1, '标准视频生成积分'),
('points.video_hd', '100', 'number', 1, '高清视频生成积分'),
('points.chat_1k_tokens', '1', 'number', 1, '每1K Token对话积分')
ON DUPLICATE KEY UPDATE
  `config_value` = VALUES(`config_value`),
  `config_type` = VALUES(`config_type`),
  `is_public` = VALUES(`is_public`),
  `description` = VALUES(`description`);

-- 10. 创建 verification_codes 表（如果不存在）
CREATE TABLE IF NOT EXISTS `verification_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `target` VARCHAR(128) NOT NULL COMMENT '目标（邮箱或手机）',
  `code` VARCHAR(16) NOT NULL COMMENT '验证码',
  `type` ENUM('email', 'phone', 'password_reset') DEFAULT 'email' COMMENT '类型',
  `is_used` TINYINT(1) DEFAULT 0 COMMENT '是否已使用',
  `expires_at` TIMESTAMP NOT NULL COMMENT '过期时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_target` (`target`),
  INDEX `idx_code` (`code`),
  INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验证码表';

-- 完成
SELECT '数据库表结构修复完成！' AS message;
