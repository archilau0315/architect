-- 更新管理员密码
-- 新密码: admin123
-- 这是一个 bcrypt 哈希值

UPDATE admins 
SET password_hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE username = 'admin';
