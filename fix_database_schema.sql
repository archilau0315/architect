-- 修复数据库表结构

-- 1. 检查并修复 beta_applications 表
ALTER TABLE beta_applications
    MODIFY COLUMN applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    MODIFY COLUMN approved_at DATETIME NULL,
    MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- 2. 检查并修复 users 表
ALTER TABLE users
    MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    MODIFY COLUMN daily_points INT NOT NULL DEFAULT 0,
    MODIFY COLUMN purchased_points INT NOT NULL DEFAULT 0,
    MODIFY COLUMN total_consumed_points INT NOT NULL DEFAULT 0,
    MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'inactive';

-- 3. 检查并修复 usage_logs 表
ALTER TABLE usage_logs
    MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    MODIFY COLUMN user_id VARCHAR(50) NOT NULL,
    MODIFY COLUMN feature VARCHAR(50) NOT NULL,
    MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- 4. 检查系统配置中的时区设置
INSERT INTO system_config (config_key, config_value, description, config_type)
VALUES ('timezone', 'Asia/Shanghai', '系统时区', 'system')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    description = VALUES(description),
    config_type = VALUES(config_type),
    updated_at = NOW();

-- 5. 检查待处理的内测申请
SELECT id, email, applied_at, status FROM beta_applications WHERE status = 'pending';

-- 6. 检查使用日志
SELECT COUNT(*) as log_count FROM usage_logs;
SELECT * FROM usage_logs LIMIT 5;
