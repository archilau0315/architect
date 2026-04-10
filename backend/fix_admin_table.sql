-- 修复管理员表结构 - 智能版本
-- 只添加不存在的字段

USE kbitai0302;

-- 检查并添加 last_login_at 字段
SELECT COUNT(*) INTO @count FROM information_schema.columns 
WHERE table_schema = 'kbitai0302' AND table_name = 'admins' AND column_name = 'last_login_at';

SET @sql = IF(@count = 0, 'ALTER TABLE admins ADD COLUMN last_login_at TIMESTAMP NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 last_login_ip 字段
SELECT COUNT(*) INTO @count FROM information_schema.columns 
WHERE table_schema = 'kbitai0302' AND table_name = 'admins' AND column_name = 'last_login_ip';

SET @sql = IF(@count = 0, 'ALTER TABLE admins ADD COLUMN last_login_ip VARCHAR(45) NULL;', 'SELECT 1;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 updated_at 字段
SELECT COUNT(*) INTO @count FROM information_schema.columns 
WHERE table_schema = 'kbitai0302' AND table_name = 'admins' AND column_name = 'updated_at';

SET @sql = IF(@count = 0, 'ALTER TABLE admins ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;', 'SELECT 1;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 重新创建 beta_applications 表
DROP TABLE IF EXISTS beta_applications;

CREATE TABLE beta_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL COMMENT '申请人姓名',
  email VARCHAR(128) NOT NULL COMMENT '邮箱',
  phone VARCHAR(20) COMMENT '手机号',
  company VARCHAR(128) COMMENT '公司/机构',
  purpose ENUM('architecture', 'product', 'education', 'research', 'entertainment', 'other') NOT NULL COMMENT '使用场景',
  experience ENUM('none', 'beginner', 'intermediate', 'expert') DEFAULT NULL COMMENT 'AI使用经验',
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审核状态',
  approved_at TIMESTAMP NULL COMMENT '批准时间',
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_applied_at (applied_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内测申请表';

-- 插入或更新默认管理员用户
INSERT INTO admins (username, password_hash, role) VALUES 
('admin', '$2y$10$eJ4cQ5qJ3aB2sD1fG7hI9jK8lM0nO6pQ7rS8tU9vW0xY1zA2bC3dE4f', 'super')
ON DUPLICATE KEY UPDATE updated_at = NOW();
