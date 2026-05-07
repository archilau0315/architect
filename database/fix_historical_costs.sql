USE kbitai0302;

UPDATE kbit_usage_logs
SET actual_cost = 0.0120, points_cost = 12
WHERE feature = 'image_gen'
  AND model_id = 'gemini-3.1-flash-image-preview'
  AND status = 'success'
  AND (actual_cost = 0 OR points_cost = 0 OR actual_cost IS NULL OR points_cost IS NULL);

UPDATE kbit_usage_logs
SET actual_cost = 0.0120, points_cost = 12
WHERE feature = 'image_gen'
  AND status = 'success'
  AND (actual_cost = 0 OR points_cost = 0 OR actual_cost IS NULL OR points_cost IS NULL)
  AND model_id != 'gemini-3.1-flash-image-preview';

UPDATE kbit_usage_logs
SET actual_cost = 0.2100, points_cost = 210
WHERE feature = 'video_gen'
  AND status = 'success'
  AND (actual_cost = 0 OR points_cost = 0 OR actual_cost IS NULL OR points_cost IS NULL);

UPDATE kbit_usage_logs
SET actual_cost = 0.0050, points_cost = 5
WHERE feature = 'chat'
  AND status = 'success'
  AND (actual_cost = 0 OR points_cost = 0 OR actual_cost IS NULL OR points_cost IS NULL);

UPDATE kbit_usage_logs
SET actual_cost = 0.0080, points_cost = 8
WHERE feature = 'image_analyze'
  AND status = 'success'
  AND (actual_cost = 0 OR points_cost = 0 OR actual_cost IS NULL OR points_cost IS NULL);

UPDATE kbit_usage_logs
SET actual_cost = 0.0030, points_cost = 3
WHERE feature = 'prompt_enhance'
  AND status = 'success'
  AND (actual_cost = 0 OR points_cost = 0 OR actual_cost IS NULL OR points_cost IS NULL);

SELECT feature, COUNT(*) AS count, SUM(actual_cost) AS total_cost, SUM(points_cost) AS total_points
FROM kbit_usage_logs
WHERE status = 'success'
GROUP BY feature
ORDER BY feature;

SELECT '历史记录修复完成！' AS result;
