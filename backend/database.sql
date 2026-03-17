-- KBITAI 内测用户管理数据库
-- 在宝塔 phpMyAdmin 中执行此脚本

-- 创建数据库（如果尚未创建）
CREATE DATABASE IF NOT EXISTS kbitai0302 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kbitai0302;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) UNIQUE NOT NULL COMMENT '用户唯一标识',
  email VARCHAR(128) UNIQUE NOT NULL COMMENT '邮箱',
  phone VARCHAR(20) COMMENT '手机号',
  password_hash VARCHAR(255) COMMENT '密码哈希',
  nickname VARCHAR(64) COMMENT '昵称',
  tier ENUM('free', 'beta', 'basic', 'pro', 'plus') DEFAULT 'free' COMMENT '用户等级',
  total_points INT DEFAULT 0 COMMENT '总积分',
  daily_quota INT DEFAULT 100 COMMENT '每日额度',
  daily_used INT DEFAULT 0 COMMENT '今日已用',
  last_reset_date DATE COMMENT '上次重置日期',
  status ENUM('active', 'suspended', 'deleted') DEFAULT 'active' COMMENT '状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_email (email),
  INDEX idx_tier (tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 邀请码表
CREATE TABLE IF NOT EXISTS invite_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(16) UNIQUE NOT NULL COMMENT '邀请码',
  created_by VARCHAR(64) NOT NULL COMMENT '创建者用户ID',
  used_by VARCHAR(64) COMMENT '使用者用户ID',
  max_uses INT DEFAULT 1 COMMENT '最大使用次数',
  current_uses INT DEFAULT 0 COMMENT '当前使用次数',
  points_bonus INT DEFAULT 1000 COMMENT '赠送积分',
  status ENUM('active', 'used', 'expired') DEFAULT 'active' COMMENT '状态',
  expires_at TIMESTAMP NULL COMMENT '过期时间',
  used_at TIMESTAMP NULL COMMENT '使用时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请码表';

-- 内测申请表
CREATE TABLE IF NOT EXISTS beta_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(128) NOT NULL COMMENT '邮箱',
  phone VARCHAR(20) COMMENT '手机号',
  reason TEXT COMMENT '申请理由',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '状态',
  apply_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  review_at TIMESTAMP NULL COMMENT '审核时间',
  reviewer VARCHAR(64) COMMENT '审核人',
  INDEX idx_email (email),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内测申请表';

-- 积分日志表
CREATE TABLE IF NOT EXISTS point_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  amount INT COMMENT '积分变动（负数为消耗）',
  type ENUM('daily_reset', 'consume', 'bonus', 'refund', 'invite') NOT NULL COMMENT '类型',
  description VARCHAR(255) COMMENT '描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分日志表';

-- 下载日志表（合规要求保留6个月）
CREATE TABLE IF NOT EXISTS download_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_id VARCHAR(64) NOT NULL COMMENT '内容编号',
  content_type ENUM('image', 'video') NOT NULL COMMENT '内容类型',
  user_id VARCHAR(64) COMMENT '用户ID',
  download_type ENUM('standard', 'watermarked') NOT NULL COMMENT '下载类型',
  ip_address VARCHAR(45) COMMENT 'IP地址',
  user_agent TEXT COMMENT '浏览器信息',
  metadata JSON COMMENT '元数据信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content_id (content_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='下载日志表';

-- 内容注册表（合规要求）
CREATE TABLE IF NOT EXISTS content_registry (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_id VARCHAR(64) UNIQUE NOT NULL COMMENT '内容唯一编号',
  content_type ENUM('image', 'video') NOT NULL COMMENT '内容类型',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  platform_code VARCHAR(32) DEFAULT 'KBITAI' COMMENT '平台编码',
  generate_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  metadata JSON COMMENT '元数据信息',
  INDEX idx_content_id (content_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容注册表';

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL COMMENT '用户名',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  role ENUM('super', 'admin') DEFAULT 'admin' COMMENT '角色',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';

-- 插入默认管理员（密码: admin123，请在生产环境修改）
-- INSERT INTO admins (username, password_hash, role) VALUES 
-- ('admin', '$2b$10$YourHashedPasswordHere', 'super');

-- 插入测试邀请码
-- INSERT INTO invite_codes (code, created_by, points_bonus, status) VALUES 
-- ('KBITAI2026', 'system', 1000, 'active');

-- Token 用量统计表
CREATE TABLE IF NOT EXISTS token_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  request_id VARCHAR(64) COMMENT '请求ID',
  model VARCHAR(64) NOT NULL COMMENT '模型名称',
  prompt_tokens INT DEFAULT 0 COMMENT '输入Token数',
  completion_tokens INT DEFAULT 0 COMMENT '输出Token数',
  total_tokens INT DEFAULT 0 COMMENT '总Token数',
  request_type ENUM('chat', 'image', 'video', 'enhance', 'analyze') NOT NULL COMMENT '请求类型',
  status ENUM('success', 'failed', 'rate_limited') DEFAULT 'success' COMMENT '状态',
  ip_address VARCHAR(45) COMMENT 'IP地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_model (model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Token用量统计表';

-- 用户配额表（实时监控）
CREATE TABLE IF NOT EXISTS user_quotas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) UNIQUE NOT NULL COMMENT '用户ID',
  tier ENUM('free', 'beta', 'basic', 'pro', 'plus') DEFAULT 'free' COMMENT '用户等级',
  daily_token_limit INT DEFAULT 10000 COMMENT '每日Token限额',
  daily_tokens_used INT DEFAULT 0 COMMENT '今日已用Token',
  monthly_token_limit INT DEFAULT 300000 COMMENT '每月Token限额',
  monthly_tokens_used INT DEFAULT 0 COMMENT '本月已用Token',
  total_tokens_used BIGINT DEFAULT 0 COMMENT '累计Token用量',
  request_count_today INT DEFAULT 0 COMMENT '今日请求次数',
  request_count_month INT DEFAULT 0 COMMENT '本月请求次数',
  last_request_at TIMESTAMP NULL COMMENT '最后请求时间',
  last_reset_daily TIMESTAMP NULL COMMENT '每日重置时间',
  last_reset_monthly TIMESTAMP NULL COMMENT '每月重置时间',
  is_limited TINYINT(1) DEFAULT 0 COMMENT '是否限流中',
  limited_until TIMESTAMP NULL COMMENT '限流解除时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_tier (tier),
  INDEX idx_is_limited (is_limited)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户配额表';

-- 限流日志表
CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  limit_type ENUM('daily_token', 'monthly_token', 'rate_per_minute', 'concurrent') NOT NULL COMMENT '限流类型',
  tokens_attempted INT COMMENT '尝试使用的Token数',
  limit_value INT COMMENT '限额值',
  current_value INT COMMENT '当前值',
  ip_address VARCHAR(45) COMMENT 'IP地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='限流日志表';

-- 用户等级配额配置
CREATE TABLE IF NOT EXISTS tier_limits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tier ENUM('free', 'beta', 'basic', 'pro', 'plus') UNIQUE NOT NULL COMMENT '用户等级',
  daily_token_limit INT NOT NULL COMMENT '每日Token限额',
  monthly_token_limit INT NOT NULL COMMENT '每月Token限额',
  requests_per_minute INT DEFAULT 10 COMMENT '每分钟请求数限制',
  concurrent_requests INT DEFAULT 3 COMMENT '并发请求数限制',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='等级配额配置表';

-- 插入默认等级配额
INSERT INTO tier_limits (tier, daily_token_limit, monthly_token_limit, requests_per_minute, concurrent_requests) VALUES
('free', 10000, 300000, 5, 2),
('beta', 50000, 1500000, 10, 3),
('basic', 100000, 3000000, 15, 5),
('pro', 300000, 9000000, 30, 10),
('plus', 1000000, 30000000, 60, 20)
ON DUPLICATE KEY UPDATE updated_at = NOW();
