-- ============================================
-- 首席图像架构师 - 积分字段重构脚本
-- 版本: 2.0.0
-- 公司: 天津匡形无界智能科技有限公司
-- 执行时间: 2026-05-02
-- ============================================

-- 执行前请务必备份数据库！
-- 备份命令: mysqldump -u kbitai0302 -p kbitai0302 > backup_$(date +%Y%m%d).sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 第一步：备份现有积分数据
-- ============================================
CREATE TABLE IF NOT EXISTS `kbit_users_backup_20260502` AS
SELECT 
  id, email, nickname, user_tier,
  daily_points AS old_daily_points,
  bonus_points AS old_bonus_points,
  purchased_points AS old_purchased_points,
  total_consumed_points AS old_total_consumed_points,
  bonus_expires_at AS old_bonus_expires_at,
  daily_used AS old_daily_used,
  last_reset_date AS old_last_reset_date,
  tier_expires_at, status, created_at, updated_at
FROM kbit_users;

SELECT '第一步完成：已备份用户积分数据到 kbit_users_backup_20260502' AS status;

-- ============================================
-- 第二步：修改 kbit_users 表结构
-- ============================================

-- 2.1 删除旧的积分字段
ALTER TABLE `kbit_users` 
  DROP COLUMN IF EXISTS `daily_points`,
  DROP COLUMN IF EXISTS `bonus_points`,
  DROP COLUMN IF EXISTS `purchased_points`,
  DROP COLUMN IF EXISTS `total_consumed_points`,
  DROP COLUMN IF EXISTS `bonus_expires_at`,
  DROP COLUMN IF EXISTS `daily_used`,
  DROP COLUMN IF EXISTS `last_reset_date`;

-- 2.2 添加新的统一积分字段
ALTER TABLE `kbit_users`
  ADD COLUMN `total_points` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '用户总积分余额（统一积分池）' AFTER `user_tier`,
  ADD COLUMN `daily_quota` INT UNSIGNED NOT NULL DEFAULT 200 COMMENT '每日积分限额（根据等级不同）' AFTER `total_points`,
  ADD COLUMN `daily_used` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '今日已使用积分' AFTER `daily_quota`,
  ADD COLUMN `daily_reset_at` DATE DEFAULT NULL COMMENT '上次每日积分重置日期' AFTER `daily_used`;

SELECT '第二步完成：kbit_users 表结构已更新' AS status;

-- ============================================
-- 第三步：初始化用户积分数据
-- ============================================

-- 3.1 计算每个用户的初始总积分
-- 规则：总积分 = 每日积分 + 赠送积分 + 购买积分 - 累计消耗
UPDATE kbit_users u
INNER JOIN kbit_users_backup_20260502 b ON u.id = b.id
SET u.total_points = GREATEST(0, 
  COALESCE(b.old_bonus_points, 0) + COALESCE(b.old_purchased_points, 0) - COALESCE(b.old_total_consumed_points, 0)
),
u.daily_quota = CASE 
  WHEN b.user_tier = 'beta' THEN 200
  WHEN b.user_tier = 'basic' THEN 400
  WHEN b.user_tier = 'pro' THEN 1500
  WHEN b.user_tier = 'plus' THEN 2000
  ELSE 200
END,
u.daily_used = COALESCE(b.old_daily_used, 0),
u.daily_reset_at = COALESCE(b.old_last_reset_date, CURDATE());

SELECT '第三步完成：用户积分数据已初始化' AS status;

-- ============================================
-- 第四步：添加索引
-- ============================================

-- 4.1 为 kbit_users 表添加索引
ALTER TABLE `kbit_users`
  ADD INDEX `idx_user_tier_points` (`user_tier`, `total_points`),
  ADD INDEX `idx_daily_reset` (`daily_reset_at`);

-- 4.2 为 kbit_usage_logs 表添加复合索引
ALTER TABLE `kbit_usage_logs`
  ADD INDEX `idx_user_feature_date` (`user_id`, `feature`, `created_at`),
  ADD INDEX `idx_created_status` (`created_at`, `status`);

SELECT '第四步完成：索引已添加' AS status;

-- ============================================
-- 第五步：更新字段注释
-- ============================================

ALTER TABLE `kbit_users`
  COMMENT = '用户账户表 - 积分说明：total_points=用户总积分余额, daily_quota=每日限额, daily_used=今日已用';

ALTER TABLE `kbit_tiers`
  COMMENT = '用户等级配置表 - 每日积分由本表统一配置，不再分散存储';

SELECT '第五步完成：字段注释已更新' AS status;

-- ============================================
-- 第六步：验证数据
-- ============================================

SELECT '=== 用户积分数据验证 ===' AS title;
SELECT id, email, nickname, user_tier, total_points, daily_quota, daily_used, daily_reset_at
FROM kbit_users
ORDER BY id
LIMIT 10;

SELECT '=== 备份表数据验证 ===' AS title;
SELECT id, email, old_bonus_points, old_purchased_points, old_total_consumed_points
FROM kbit_users_backup_20260502
ORDER BY id
LIMIT 10;

SELECT '=== 验证计算结果 ===' AS title;
SELECT 
  b.id,
  b.email,
  b.user_tier,
  b.old_bonus_points AS 赠送积分,
  b.old_purchased_points AS 购买积分,
  b.old_total_consumed_points AS 累计消耗,
  (COALESCE(b.old_bonus_points, 0) + COALESCE(b.old_purchased_points, 0) - COALESCE(b.old_total_consumed_points, 0)) AS 计算总积分,
  u.total_points AS 新总积分,
  CASE 
    WHEN (COALESCE(b.old_bonus_points, 0) + COALESCE(b.old_purchased_points, 0) - COALESCE(b.old_total_consumed_points, 0)) = u.total_points 
    THEN '✓ 正确' 
    ELSE '✗ 错误' 
  END AS 验证结果
FROM kbit_users_backup_20260502 b
INNER JOIN kbit_users u ON b.id = u.id
LIMIT 10;

-- ============================================
-- 完成提示
-- ============================================
SELECT '========================================' AS separator;
SELECT '数据库重构完成！' AS message;
SELECT '请执行后端代码适配新结构！' AS warning;
SELECT '========================================' AS separator;

SET FOREIGN_KEY_CHECKS = 1;
