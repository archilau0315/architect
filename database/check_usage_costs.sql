SELECT 
  id,
  feature,
  model_id,
  points_cost,
  actual_cost,
  status,
  created_at
FROM kbit_usage_logs
WHERE feature IN ('image_gen', 'video_gen')
ORDER BY created_at DESC
LIMIT 10;