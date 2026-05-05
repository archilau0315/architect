-- ============================================
-- 积分模型修正：添加 total_earned（总积分/总资产）
-- 版本: 2.1.0
-- 日期: 2026-05-03
-- ============================================
-- 
-- 正确模型：
--   total_earned  = 赠送积分 + 充值积分（只增不减，总资产）
--   total_points  = 当前余额 = total_earned - 累计消耗
--   daily_quota   = 每日免费额度
--   daily_used    = 今日已用额度
--
-- 执行前请备份数据库！
-- mysqldump -u kbitai0302 -p kbitai0302 > backup_v21.sql

SET NAMES utf8mb4;

-- 第一步：添加 total_earned 字段（总资产：赠送+充值，只增不减）
ALTER TABLE `kbit_users`
  ADD COLUMN `total_earned` INT UNSIGNED NOT NULL DEFAULT 0 
  COMMENT '用户总积分（赠送+充值，只增不减）' AFTER `user_tier`;

SELECT '第一步完成：已添加 total_earned 字段' AS status;

-- 第二步：初始化 total_earned
-- 规则：total_earned = 当前的 total_points(余额) + 从 usage_logs 算出的累计消耗
UPDATE kbit_users u
LEFT JOIN (
  SELECT user_id, COALESCE(SUM(points_cost), 0) as consumed
  FROM kbit_usage_logs GROUP BY user_id
) ul ON u.id = ul.user_id
SET u.total_earned = u.total_points + COALESCE(ul.consumed, 0);

SELECT '第二步完成：total_earned 已初始化（=当前余额+累计消耗）' AS status;

-- 第三步：验证数据
SELECT '=== 验证 ===' AS title;
SELECT 
  id, email, nickname,
  total_earned AS '总积分(资产)',
  total_points AS '余额',
  (total_earned - total_points) AS '累计消耗差值',
  daily_quota AS '每日额度',
  daily_used AS '今日已用'
FROM kbit_users ORDER BY id LIMIT 10;

SELECT '========================================' AS separator;
SELECT '数据库修正 v2.1 完成！' AS message;
SELECT '请更新后端代码适配新字段！' AS warning;
SELECT '========================================' AS separator;
