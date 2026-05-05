-- ============================================
-- 服务器数据库增量更新脚本（精简版）
-- 数据库: kbitai0302
-- 说明: 只添加缺失的 daily_used 字段
-- ============================================

USE kbitai0302;

-- 添加 daily_used 字段（当日已消耗积分）
ALTER TABLE `kbit_users` ADD COLUMN `daily_used` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '当日已消耗积分' AFTER `bonus_expires_at`;

-- ============================================
-- 验证执行结果
-- ============================================

SELECT '=== 更新完成 ===' AS result;
SELECT id, email, user_tier, bonus_points, purchased_points, daily_points, daily_used, total_consumed_points, last_reset_date FROM `kbit_users` LIMIT 10;