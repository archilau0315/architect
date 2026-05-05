-- ============================================
-- PH8视频API响应数据分析脚本
-- 用途：从ph8_api_logs提取实际响应数据，分析费用格式
-- ============================================

SET NAMES utf8mb4;

-- 第一步：检查ph8_api_logs表是否存在并查看结构
SELECT '=== 检查ph8_api_logs表 ===' AS step;
SHOW TABLES LIKE 'ph8_api_logs';

-- 第二步：查看最近50条视频相关API调用记录
SELECT '=== 视频API调用记录（最近50条）===' AS step;
SELECT 
  log_id,
  user_id,
  user_nickname,
  endpoint,
  status_code,
  LEFT(request_body, 200) AS request_preview,
  LEFT(response_body, 500) AS response_preview,
  created_at
FROM ph8_api_logs 
WHERE endpoint LIKE '%video%' OR endpoint LIKE '%videos%'
ORDER BY created_at DESC
LIMIT 50;

-- 第三步：分析视频API响应中的费用字段（JSON解析）
SELECT '=== 视频API响应费用分析 ===' AS step;
SELECT 
  log_id,
  endpoint,
  status_code,
  -- 尝试从response_body中提取cost相关字段
  CASE 
    WHEN response_body LIKE '%"cost"%' THEN SUBSTRING_INDEX(SUBSTRING_INDEX(response_body, '"cost":', -1), ',', 1)
    WHEN response_body LIKE '%"price"%' THEN SUBSTRING_INDEX(SUBSTRING_INDEX(response_body, '"price":', -1), ',', 1)
    WHEN response_body LIKE '%"total_tokens"%' THEN CONCAT('tokens:', SUBSTRING_INDEX(SUBSTRING_INDEX(response_body, '"total_tokens":', -1), ',', 1))
    ELSE 'NO_COST_DATA'
  END AS extracted_cost_data,
  created_at
FROM ph8_api_logs 
WHERE endpoint LIKE '%video%' OR endpoint LIKE '%videos%'
ORDER BY created_at DESC
LIMIT 30;

-- 第四步：统计不同状态码的视频请求分布
SELECT '=== 视频请求状态码分布 ===' AS step;
SELECT 
  status_code,
  COUNT(*) AS request_count,
  SUM(CASE WHEN response_body LIKE '%"cost":"0"' OR response_body LIKE '%"cost":0' THEN 1 ELSE 0 END) AS zero_cost_count,
  SUM(CASE WHEN response_body LIKE '%"cost":"0"' = 0 AND response_body LIKE '%"cost":0' = 0 AND (response_body LIKE '%"cost"%' OR response_body LIKE '%"price"%') THEN 1 ELSE 0 END) AS has_cost_count
FROM ph8_api_logs 
WHERE endpoint LIKE '%video%' OR endpoint LIKE '%videos%'
GROUP BY status_code;

-- 第五步：查找包含usage数据的成功视频响应
SELECT '=== 包含usage数据的视频响应 ===' AS step;
SELECT 
  log_id,
  user_id,
  endpoint,
  CASE 
    WHEN response_body LIKE '%"usage"%' THEN 'HAS_USAGE'
    ELSE 'NO_USAGE'
  END AS has_usage_flag,
  -- 提取usage中的关键信息
  CASE 
    WHEN response_body LIKE '%"usage":{"total_tokens":%}' THEN 
      SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(response_body, '"total_tokens":', -1), '}', 1), ',', 1)
    WHEN response_body LIKE '%"total_tokens":%' THEN 
      SUBSTRING_INDEX(SUBSTRING_INDEX(response_body, '"total_tokens":', -1), ',', 1)
    ELSE NULL
  END AS total_tokens_value,
  created_at
FROM ph8_api_logs 
WHERE (endpoint LIKE '%video%' OR endpoint LIKE '%videos%')
  AND status_code = 200
ORDER BY created_at DESC
LIMIT 20;
