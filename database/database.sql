-- KBITAI 内测用户管理数据库
-- 在宝塔 phpMyAdmin 中执行此脚本

-- 创建数据库（如果尚未创建）
CREATE DATABASE IF NOT EXISTS kbitai0302 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kbitai0302;

-- 用户表
CREATE TABLE IF NOT EXISTS kbit_users (
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
  tier VARCHAR(16) DEFAULT 'beta' COMMENT '用户等级(free/beta/basic/pro/plus)',
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
  nickname VARCHAR(64) COMMENT '昵称',
  company VARCHAR(128) COMMENT '公司/组织',
  reason TEXT COMMENT '申请理由',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '状态',
  invite_code VARCHAR(16) COMMENT '发放的邀请码',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内测申请表';

-- 积分日志表
CREATE TABLE IF NOT EXISTS point_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  user_nickname VARCHAR(64) COMMENT '用户昵称',
  user_email VARCHAR(128) COMMENT '用户邮箱',
  amount INT NOT NULL COMMENT '积分数量',
  type ENUM('deposit', 'consume', 'refund', 'bonus') COMMENT '类型',
  description TEXT COMMENT '描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分日志表';

-- 下载日志表
CREATE TABLE IF NOT EXISTS download_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_id VARCHAR(64) COMMENT '内容ID',
  content_type ENUM('image', 'video', 'audio') COMMENT '内容类型',
  user_id VARCHAR(64) COMMENT '用户ID',
  download_type ENUM('standard', 'high', 'original') DEFAULT 'standard' COMMENT '下载类型',
  metadata TEXT COMMENT '元数据',
  ip_address VARCHAR(45) COMMENT 'IP地址',
  user_agent TEXT COMMENT '浏览器信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content_id (content_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='下载日志表';

-- 内容注册表
CREATE TABLE IF NOT EXISTS content_registry (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_id VARCHAR(64) UNIQUE NOT NULL COMMENT '内容ID',
  content_type ENUM('image', 'video', 'audio') NOT NULL COMMENT '内容类型',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  metadata TEXT COMMENT '元数据',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content_id (content_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容注册表';

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL COMMENT '用户名',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  role ENUM('super', 'admin', 'operator') DEFAULT 'operator' COMMENT '角色',
  last_login_at TIMESTAMP NULL COMMENT '上次登录时间',
  last_login_ip VARCHAR(45) COMMENT '上次登录IP',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';

-- 密码重置令牌表
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(128) NOT NULL COMMENT '邮箱',
  token VARCHAR(255) UNIQUE NOT NULL COMMENT '令牌',
  expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
  used_at TIMESTAMP NULL COMMENT '使用时间',
  user_type ENUM('user', 'admin') DEFAULT 'user' COMMENT '用户类型',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_token (token),
  INDEX idx_user_type (user_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='密码重置令牌表';

-- 如果 user_type 字段不存在，添加该字段
ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS user_type ENUM('user', 'admin') DEFAULT 'user' COMMENT '用户类型';
ALTER TABLE password_reset_tokens ADD INDEX IF NOT EXISTS idx_user_type (user_type);

-- 用户配额表
CREATE TABLE IF NOT EXISTS user_quotas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) UNIQUE NOT NULL COMMENT '用户ID',
  daily_quota INT DEFAULT 100 COMMENT '每日额度',
  daily_used INT DEFAULT 0 COMMENT '今日已用',
  last_reset_date DATE COMMENT '上次重置日期',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户配额表';

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(64) UNIQUE NOT NULL COMMENT '配置键',
  config_value TEXT COMMENT '配置值',
  description VARCHAR(255) COMMENT '描述',
  updated_by VARCHAR(64) COMMENT '更新者',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 监控表
CREATE TABLE IF NOT EXISTS monitoring_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('api', 'system', 'error') COMMENT '监控类型',
  endpoint VARCHAR(255) COMMENT 'API端点',
  method VARCHAR(10) COMMENT '请求方法',
  status_code INT COMMENT '状态码',
  duration_ms INT COMMENT '响应时间',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  ip_address VARCHAR(45) COMMENT 'IP地址',
  user_agent TEXT COMMENT '浏览器信息',
  error_message TEXT COMMENT '错误信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_user_id (user_id),
  INDEX idx_endpoint (endpoint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='监控日志表';

-- 初始化管理员账号（默认密码：admin123）
-- INSERT INTO admins (username, password_hash, role) VALUES 
-- ('admin', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'super');

-- [标准化] 初始化系统配置 - 用户等级每日积分
INSERT INTO system_configs (config_key, config_value, description) VALUES
('daily_quota_free', '200', '免费用户每日额度'),
('daily_quota_beta', '200', '内测用户每日额度'),
('daily_quota_basic', '400', '基础用户每日额度'),
('daily_quota_pro', '1500', '专业用户每日额度'),
('daily_quota_plus', '2000', '高级用户每日额度'),
('points_per_token', '0.01', '每Token消耗积分'),
('invite_bonus', '1000', '邀请注册奖励积分')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);
