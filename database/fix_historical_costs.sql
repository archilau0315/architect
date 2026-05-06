-- 修复图像生成记录的费用
USE kbitai0302;

-- 1. 查看所有图像生成记录的费用情况
SELECT id, user_id, feature, model_id, points_cost, actual_cost, status, created_at
FROM kbit_usage_logs
WHERE feature = 'image_gen'
  AND status = 'success'
ORDER BY created_at DESC;

-- 2. 修复图像生成记录 (PH8图像费用通常为 ¥0.0120 - ¥0.0800)
-- 根据PH8平台记录，gemini-3.1-flash-image-preview 每次约 ¥0.0120
UPDATE kbit_usage_logs
SET actual_cost = 0.0120, points_cost = 12
WHERE feature = 'image_gen'
  AND model_id = 'gemini-3.1-flash-image-preview'
  AND status = 'success'
  AND (actual_cost = 0 OR points_cost = 0);

-- 3. 修复视频生成记录 (PH8视频费用通常为 ¥0.2100)
UPDATE kbit_usage_logs
SET actual_cost = 0.2100, points_cost = 210
WHERE feature = 'video_gen'
  AND status = 'success'
  AND (actual_cost = 0 OR points_cost = 0);

-- 4. 验证修复结果
SELECT id, feature, model_id, points_cost, actual_cost, status
FROM kbit_usage_logs
WHERE user_id = 13
  AND status = 'success'
ORDER BY created_at DESC;

SELECT '图像生成记录修复完成！' AS result;