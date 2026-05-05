-- ============================================
-- 视频积分消耗数据修正脚本
-- 版本: 1.0.0
-- 日期: 2026-05-05
-- 用途：根据PH8接口标准费率修正错误的视频积分记录
-- 
-- PH8视频费用标准：
-- - 基础费率：100000 tokens = ¥0.42
-- - 单价：¥0.0000042 per token
-- - 积分换算：1元 = 1000积分
-- ============================================

SET NAMES utf8mb4;

-- ⚠️ 重要提示：执行前请先备份数据库！
-- CREATE TABLE kbit_usage_logs_backup_20260505 AS SELECT * FROM kbit_usage_logs;

-- 第一步：创建临时表存储需要修正的记录
DROP TABLE IF EXISTS temp_video_corrections;

CREATE TABLE temp_video_corrections (
  id BIGINT UNSIGNED PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  request_id VARCHAR(50) NOT NULL,
  old_points_cost DECIMAL(10,2) DEFAULT 0,
  new_points_cost DECIMAL(10,2) DEFAULT 0,
  correction_reason VARCHAR(200),
  created_at DATETIME
);

-- 第二步：识别并标记需要修正的记录
-- 规则1：状态为success但points_cost=0的视频记录（最可能的错误）
INSERT INTO temp_video_corrections (id, user_id, request_id, old_points_cost, new_points_cost, correction_reason, created_at)
SELECT 
  ul.id,
  ul.user_id,
  ul.request_id,
  ul.points_cost AS old_points_cost,
  -- 根据PH8标准费率计算：假设每次视频生成约142857 tokens（对应¥0.60 = 60积分）
  -- 这是基于之前正常记录的平均值估算
  60 AS new_points_cost,
  '成功状态但积分为0，按标准费率修正',
  ul.created_at
FROM kbit_usage_logs ul
WHERE ul.feature = 'video_gen'
  AND ul.status = 'success'
  AND ul.points_cost = 0;

-- 第三步：查看待修正的记录数量和详情
SELECT '=== 待修正的记录统计 ===' AS info;
SELECT COUNT(*) AS total_records_to_fix FROM temp_video_corrections;

SELECT '=== 待修正的记录详情（前20条）===' AS info;
SELECT 
  tc.id,
  tc.user_id,
  u.email,
  u.nickname,
  tc.request_id,
  tc.old_points_cost,
  tc.new_points_cost,
  tc.correction_reason,
  tc.created_at
FROM temp_video_corrections tc
LEFT JOIN kbit_users u ON tc.user_id = u.id
ORDER BY tc.created_at DESC
LIMIT 20;

-- 第四步：按用户统计修正影响
SELECT '=== 按用户统计修正影响 ===' AS info;
SELECT 
  tc.user_id,
  u.email,
  u.nickname,
  COUNT(*) AS records_to_fix,
  SUM(tc.old_points_cost) AS current_total_points,
  SUM(tc.new_points_cost) AS corrected_total_points,
  (SUM(tc.new_points_cost) - SUM(tc.old_points_cost)) AS points_difference
FROM temp_video_corrections tc
JOIN kbit_users u ON tc.user_id = u.id
GROUP BY tc.user_id, u.email, u.nickname
ORDER BY records_to_fix DESC;

-- 第五步：执行修正（⚠️ 请确认后再取消注释执行）
/*
UPDATE kbit_usage_logs ul
JOIN temp_video_corrections tc ON ul.id = tc.id
SET 
  ul.points_cost = tc.new_points_cost,
  ul.actual_cost = tc.new_points_cost / 1000,  -- 转换为元
  ul.total_tokens = 142857  -- 补充token数（60积分 / 0.0000042 ≈ 142857 tokens）
WHERE ul.feature = 'video_gen';
*/

-- 第六步：验证修正结果（修正后执行）
SELECT '=== 修正后验证 ===' AS info;
/*
SELECT 
  COUNT(*) AS total_video_records,
  SUM(CASE WHEN points_cost = 0 THEN 1 ELSE 0 END) AS still_zero_count,
  SUM(CASE WHEN points_cost > 0 THEN 1 ELSE 0 END) AS normal_count,
  AVG(points_cost) AS avg_points,
  SUM(points_cost) AS total_points
FROM kbit_usage_logs 
WHERE feature = 'video_gen' AND status = 'success';
*/

-- 第七步：同步更新用户余额（如果需要补扣积分）
-- 注意：这会影响用户的实际余额！请谨慎操作！
/*
UPDATE kbit_users u
JOIN (
  SELECT user_id, SUM(new_points_cost - old_points_cost) AS additional_deduction
  FROM temp_video_corrections
  GROUP BY user_id
) corrections ON u.id = corrections.user_id
SET 
  u.total_points = GREATEST(0, u.total_points - corrections.additional_deduction),
  u.updated_at = NOW()
WHERE corrections.additional_deduction > 0;
*/

-- 第八步：生成修正报告
SELECT '=== 数据修正报告 ===' AS report_title;
SELECT 
  '视频积分消耗修正报告' AS title,
  NOW() AS generated_at,
  (SELECT COUNT(*) FROM temp_video_corrections) AS total_corrected_records,
  (SELECT SUM(new_points_cost - old_points_cost) FROM temp_video_corrections) AS total_additional_points,
  (SELECT COUNT(DISTINCT user_id) FROM temp_video_corrections) AS affected_users;

-- 清理临时表（确认修正完成后执行）
-- DROP TABLE IF EXISTS temp_video_corrections;
