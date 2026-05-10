-- ============================================
--  为 kbit_usage_logs 表添加用户昵称和邮箱字段
--  用于管理后台直接显示用户信息，避免 JOIN 查询
--
--  执行方式：在服务器 MySQL 中执行此脚本
--  mysql -u kbitai0302 -p kbitai0302 < add_nickname_email_to_usage.sql
-- ============================================

ALTER TABLE `kbit_usage_logs`
  ADD COLUMN `user_nickname` VARCHAR(100) DEFAULT NULL COMMENT '用户昵称（冗余存储，便于管理后台显示）' AFTER `user_id`,
  ADD COLUMN `user_email` VARCHAR(255) DEFAULT NULL COMMENT '用户邮箱（冗余存储，便于管理后台显示）' AFTER `user_nickname`;

-- 为已有数据回填昵称和邮箱（可选，建议执行）
UPDATE kbit_usage_logs ul
  LEFT JOIN kbit_users u ON ul.user_id = u.id
  SET ul.user_nickname = u.nickname,
      ul.user_email = u.email
  WHERE ul.user_nickname IS NULL AND ul.user_id > 0;
