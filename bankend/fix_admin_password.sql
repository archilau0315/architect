-- 修复管理员密码
-- 新密码: admin123
-- 执行此 SQL 语句来更新管理员密码

UPDATE admins 
SET password_hash = '$2y$10$gpoN40iEdfdruj79P5rGduNKXT/Og1LX1FdzBS7uxH9LuX9G6H3SC'
WHERE username = 'admin';

-- 验证更新结果
SELECT id, username, role, 
       CONCAT(LEFT(password_hash, 50), '...') as password_hash_preview,
       LENGTH(password_hash) as hash_length
FROM admins 
WHERE username = 'admin';
