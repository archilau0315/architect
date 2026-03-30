-- ============================================
-- 删除重复旧表脚本
-- 执行前请确保已备份数据库
-- ============================================

USE kbitai0302;

-- 删除重复的旧表
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS point_logs;
DROP TABLE IF EXISTS token_usage;
DROP TABLE IF EXISTS user_quotas;
DROP TABLE IF EXISTS tier_limits;
DROP TABLE IF EXISTS rate_limit_logs;
DROP TABLE IF EXISTS ph8_token_usage;
DROP TABLE IF EXISTS user_ph8_balance;

-- 可选：删除旧版 admins（如果已使用 kbit_admins）
-- DROP TABLE IF EXISTS admins;

-- 验证剩余表
SHOW TABLES;
