-- ============================================
-- 视频积分消耗错误排查与修正脚本
-- 版本: 1.0.0
-- 日期: 2026-05-05
-- 用途: 检查并修复视频生成的积分消耗错误记录
-- ============================================

SET NAMES utf8mb4;

-- 第一步：查看所有视频生成记录概览
SELECT '=== 第一步：视频生成记录概览 ===' AS step;
SELECT 
  COUNT(*) AS total_records,
  SUM(CASE WHEN points_cost = 0 THEN 1 ELSE 0 END) AS zero_cost_records,
  SUM(CASE WHEN points_cost > 0 THEN 1 ELSE 0 END) AS normal_cost_records,
  SUM(points_cost) AS total_points_consumed,
  AVG(points_cost) AS avg_points_per_video,
  MIN(created_at) AS earliest_record,
  MAX(created_at) AS latest_record
FROM kbit_usage_logs 
WHERE feature = 'video_gen';

-- 第二步：查看消耗为0的视频记录详情（这些可能是错误记录）
SELECT '=== 第二步：消耗为0的视频记录（疑似错误）===' AS step;
SELECT 
  id, user_id, request_id, model_id, feature, channel_id,
  prompt_tokens, completion_tokens, total_tokens,
  points_cost, actual_cost, status, error_message,
  created_at
FROM kbit_usage_logs 
WHERE feature = 'video_gen' AND points_cost = 0
ORDER BY created_at DESC
LIMIT 50;

-- 第三步：查看消耗正常的视频记录（用于对比）
SELECT '=== 第三步：消耗正常的视频记录（参考）===' AS step;
SELECT 
  id, user_id, request_id, model_id, feature, channel_id,
  prompt_tokens, completion_tokens, total_tokens,
  points_cost, actual_cost, status, created_at
FROM kbit_usage_logs 
WHERE feature = 'video_gen' AND points_cost > 0
ORDER BY created_at DESC
LIMIT 20;

-- 第四步：按用户统计视频消耗情况
SELECT '=== 第四步：按用户统计视频消耗 ===' AS step;
SELECT 
  u.id AS user_id,
  u.email,
  u.nickname,
  COUNT(ul.id) AS video_count,
  SUM(CASE WHEN ul.points_cost = 0 THEN 1 ELSE 0 END) AS zero_cost_count,
  SUM(CASE WHEN ul.points_cost > 0 THEN 1 ELSE 0 END) AS normal_cost_count,
  SUM(ul.points_cost) AS total_points_consumed,
  AVG(ul.points_cost) AS avg_points_per_video,
  MIN(ul.created_at) AS first_video_date,
  MAX(ul.created_at) AS last_video_date
FROM kbit_usage_logs ul
JOIN kbit_users u ON ul.user_id = u.id
WHERE ul.feature = 'video_gen'
GROUP BY u.id, u.email, u.nickname
ORDER BY video_count DESC;

-- 第五步：查看最近7天的视频消耗趋势
SELECT '=== 第五步：近7天视频消耗趋势 ===' AS step;
SELECT 
  DATE(created_at) AS video_date,
  COUNT(*) AS video_count,
  SUM(CASE WHEN points_cost = 0 THEN 1 ELSE 0 END) AS zero_cost_count,
  SUM(CASE WHEN points_cost > 0 THEN 1 ELSE 0 END) AS normal_cost_count,
  SUM(points_cost) AS total_points
FROM kbit_usage_logs 
WHERE feature = 'video_gen' 
  AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at)
ORDER BY video_date DESC;

-- 第六步：分析错误信息模式
SELECT '=== 第六步：错误信息分析 ===' AS step;
SELECT 
  error_message,
  COUNT(*) AS record_count,
  GROUP_CONCAT(id ORDER BY id SEPARATOR ', ') AS sample_ids
FROM kbit_usage_logs 
WHERE feature = 'video_gen' AND points_cost = 0
GROUP BY error_message
ORDER BY record_count DESC;

-- 第七步：检查是否有重复请求ID（可能导致重复扣费或漏扣）
SELECT '=== 第七步：重复请求ID检测 ===' AS step;
SELECT 
  request_id,
  COUNT(*) AS occurrence_count,
  GROUP_CONCAT(id ORDER BY id SEPARATOR ', ') AS log_ids,
  SUM(points_cost) AS total_points_deducted
FROM kbit_usage_logs 
WHERE feature = 'video_gen'
GROUP BY request_id
HAVING occurrence_count > 1
ORDER BY occurrence_count DESC
LIMIT 20;
