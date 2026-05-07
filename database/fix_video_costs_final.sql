-- ============================================
-- 视频积分消耗修复脚本 (最终版)
-- 数据库: kbitai0302
-- 日期: 2026-05-07
-- 用途: 修复视频生成记录中积分消耗为0的问题
-- ============================================

-- 选择数据库
USE kbitai0302;

SET NAMES utf8mb4;

-- ====================
-- 第1部分: 诊断 - 查看问题范围
-- ====================

-- 视频记录统计
SELECT '=== 1. 视频记录统计 ===' AS `步骤`;
SELECT 
  COUNT(*) AS `总记录数`,
  SUM(CASE WHEN points_cost = 0 THEN 1 ELSE 0 END) AS `积分为0的记录`,
  SUM(CASE WHEN points_cost > 0 THEN 1 ELSE 0 END) AS `正常消耗记录`,
  CONCAT(ROUND(SUM(CASE WHEN points_cost = 0 THEN 1 ELSE 0 END) / COUNT(*) * 100, 2), '%') AS `问题比例`
FROM kbit_usage_logs 
WHERE feature = 'video_gen';

-- 待修复记录详情
SELECT '=== 2. 待修复记录详情（最近20条）===' AS `步骤`;
SELECT 
  id AS `记录ID`,
  user_id AS `用户ID`,
  request_id AS `请求ID`,
  points_cost AS `当前积分`,
  actual_cost AS `当前费用(元)`,
  total_tokens AS `Token数`,
  status AS `状态`,
  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS `创建时间`
FROM kbit_usage_logs 
WHERE feature = 'video_gen' AND points_cost = 0 AND status = 'success'
ORDER BY created_at DESC 
LIMIT 20;

-- 按用户统计
SELECT '=== 3. 按用户统计问题记录 ===' AS `步骤`;
SELECT 
  ul.user_id AS `用户ID`,
  u.email AS `用户邮箱`,
  u.nickname AS `用户昵称`,
  COUNT(*) AS `问题记录数`,
  SUM(60) AS `需补扣积分`
FROM kbit_usage_logs ul
JOIN kbit_users u ON ul.user_id = u.id
WHERE ul.feature = 'video_gen' AND ul.points_cost = 0 AND ul.status = 'success'
GROUP BY ul.user_id, u.email, u.nickname
ORDER BY COUNT(*) DESC;

-- ====================
-- 第2部分: 执行修复
-- ====================

-- ⚠️ WARNING: 以下语句将修改数据！请确认备份后再取消注释执行

/*
-- 创建临时表保存修复记录（用于审计）
CREATE TABLE IF NOT EXISTS kbit_usage_logs_fix_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usage_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  old_points_cost DECIMAL(10,2) NOT NULL,
  new_points_cost DECIMAL(10,2) NOT NULL,
  old_actual_cost DECIMAL(10,4) NOT NULL,
  new_actual_cost DECIMAL(10,4) NOT NULL,
  old_total_tokens INT NOT NULL,
  new_total_tokens INT NOT NULL,
  fix_time DATETIME DEFAULT NOW(),
  INDEX (user_id),
  INDEX (usage_id)
);

-- 记录修复前的数据
INSERT INTO kbit_usage_logs_fix_log (
  usage_id, user_id, old_points_cost, new_points_cost,
  old_actual_cost, new_actual_cost, old_total_tokens, new_total_tokens
)
SELECT 
  id, user_id, points_cost, 60,
  actual_cost, 0.06, COALESCE(total_tokens, 0), 142857
FROM kbit_usage_logs 
WHERE feature = 'video_gen' AND points_cost = 0 AND status = 'success';

-- 执行修复
UPDATE kbit_usage_logs 
SET 
  points_cost = 60,
  actual_cost = 0.06,
  total_tokens = 142857
WHERE feature = 'video_gen' AND points_cost = 0 AND status = 'success';

-- ====================
-- 第3部分: 验证修复结果
-- ====================

SELECT '=== 4. 修复后验证 ===' AS `步骤`;
SELECT 
  COUNT(*) AS `总记录数`,
  SUM(CASE WHEN points_cost = 0 THEN 1 ELSE 0 END) AS `仍为0的记录`,
  SUM(CASE WHEN points_cost > 0 THEN 1 ELSE 0 END) AS `已修复记录`,
  SUM(points_cost) AS `总积分`,
  SUM(actual_cost) AS `总费用(元)`
FROM kbit_usage_logs 
WHERE feature = 'video_gen';

SELECT '=== 5. 修复日志统计 ===' AS `步骤`;
SELECT 
  COUNT(*) AS `修复记录数`,
  SUM(new_points_cost - old_points_cost) AS `累计补扣积分`,
  SUM(new_actual_cost - old_actual_cost) AS `累计补扣费用(元)`,
  COUNT(DISTINCT user_id) AS `影响用户数`
FROM kbit_usage_logs_fix_log;
*/

-- ====================
-- 执行说明:
-- 1. 先执行第1部分进行诊断
-- 2. 确认问题范围后，取消第2部分的注释
-- 3. 再次执行脚本完成修复和验证
-- ====================
