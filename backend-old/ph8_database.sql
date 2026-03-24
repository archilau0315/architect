-- PH8.co Token 精准监控数据库设计
-- 创建时间: 2026-03-23
-- 说明: 用于存储 PH8 API 调用的 Token 消耗明细和用户余额

-- ============================================
-- 1. PH8 Token 消耗明细表
-- ============================================
CREATE TABLE IF NOT EXISTS ph8_token_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usage_id VARCHAR(64) UNIQUE NOT NULL COMMENT '使用记录唯一ID',
  user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
  request_id VARCHAR(128) COMMENT 'PH8请求ID',
  model VARCHAR(64) NOT NULL COMMENT '使用的模型',
  prompt_tokens INT DEFAULT 0 COMMENT '输入token数',
  completion_tokens INT DEFAULT 0 COMMENT '输出token数',
  total_tokens INT NOT NULL COMMENT '总token数',
  cached_tokens INT DEFAULT 0 COMMENT '缓存token数（如有）',
  request_type ENUM('image', 'video', 'chat', 'audio') NOT NULL COMMENT '请求类型',
  endpoint VARCHAR(255) COMMENT '调用的API端点',
  status ENUM('success', 'error', 'timeout') DEFAULT 'success' COMMENT '请求状态',
  error_message TEXT COMMENT '错误信息（如有）',
  response_time_ms INT COMMENT '响应时间（毫秒）',
  ip_address VARCHAR(45) COMMENT '用户IP地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_request_id (request_id),
  INDEX idx_created_at (created_at),
  INDEX idx_request_type (request_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PH8 Token消耗明细表';

-- ============================================
-- 2. 用户 PH8 Token 余额表
-- ============================================
CREATE TABLE IF NOT EXISTS user_ph8_balance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_nickname VARCHAR(64) COMMENT '用户昵称',
  user_email VARCHAR(128) COMMENT '用户邮箱',
  user_id VARCHAR(64) UNIQUE NOT NULL COMMENT '用户ID',
  total_balance INT DEFAULT 0 COMMENT '总余额（token）',
  used_today INT DEFAULT 0 COMMENT '今日已用',
  used_this_month INT DEFAULT 0 COMMENT '本月已用',
  total_used BIGINT DEFAULT 0 COMMENT '累计使用',
  last_request_at TIMESTAMP NULL COMMENT '最后请求时间',
  last_reset_daily TIMESTAMP NULL COMMENT '每日重置时间',
  last_reset_monthly TIMESTAMP NULL COMMENT '每月重置时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_user_email (user_email),
  INDEX idx_user_nickname (user_nickname),
  INDEX idx_balance (total_balance)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户PH8 Token余额表';

-- ============================================
-- 3. PH8 API 调用日志表（用于调试和审计）
-- ============================================
CREATE TABLE IF NOT EXISTS ph8_api_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  log_id VARCHAR(64) UNIQUE NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_body TEXT COMMENT '请求体（脱敏）',
  response_body TEXT COMMENT '响应体（脱敏）',
  status_code INT COMMENT 'HTTP状态码',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_endpoint (endpoint),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='PH8 API调用日志';

-- ============================================
-- 4. 初始化数据（可选）
-- ============================================

-- 为现有用户创建余额记录（如果有users表）
-- INSERT INTO user_ph8_balance (user_id, total_balance)
-- SELECT user_id, 10000 FROM users 
-- WHERE user_id NOT IN (SELECT user_id FROM user_ph8_balance);

-- ============================================
-- 5. 常用查询示例
-- ============================================

-- 查询用户今日消耗
-- SELECT SUM(total_tokens) as today_total 
-- FROM ph8_token_usage 
-- WHERE user_id = 'user_id' 
-- AND DATE(created_at) = CURDATE();

-- 查询用户本月消耗
-- SELECT SUM(total_tokens) as month_total 
-- FROM ph8_token_usage 
-- WHERE user_id = 'user_id' 
-- AND YEAR(created_at) = YEAR(CURDATE()) 
-- AND MONTH(created_at) = MONTH(CURDATE());

-- 查询用户余额
-- SELECT * FROM user_ph8_balance WHERE user_id = 'user_id';

-- 查询用户使用排行
-- SELECT user_id, SUM(total_tokens) as total 
-- FROM ph8_token_usage 
-- GROUP BY user_id 
-- ORDER BY total DESC 
-- LIMIT 10;
