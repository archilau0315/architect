-- 检查数据库表结构

-- 1. 检查 beta_applications 表
DESCRIBE beta_applications;

-- 2. 检查 users 表
DESCRIBE users;

-- 3. 检查 usage_logs 表
DESCRIBE usage_logs;

-- 4. 检查待处理的内测申请
SELECT id, email, applied_at, status FROM beta_applications WHERE status = 'pending';

-- 5. 检查使用日志
SELECT COUNT(*) as log_count FROM usage_logs;
SELECT * FROM usage_logs LIMIT 5;
