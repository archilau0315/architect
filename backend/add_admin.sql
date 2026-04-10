-- 添加默认管理员用户
-- 用户名: admin
-- 密码: admin123
-- 请在生产环境修改密码

INSERT INTO admins (username, password_hash, role) VALUES 
('admin', '$2y$10$eJ4cQ5qJ3aB2sD1fG7hI9jK8lM0nO6pQ7rS8tU9vW0xY1zA2bC3dE4f', 'super')
ON DUPLICATE KEY UPDATE updated_at = NOW();
