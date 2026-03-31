-- 修复 API Key 配置（最终版本）
-- 针对包含 config_type 字段的表结构

-- 1. 添加或更新 PH8 API Key
INSERT INTO system_config (config_key, config_value, description, config_type)
VALUES ('api_key_ph8', 'sk-2f6ff8aba4d541d591d17e8eae60e75c', 'PH8.co API Key', 'api')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    description = VALUES(description),
    config_type = VALUES(config_type),
    updated_at = NOW();

-- 2. 添加或更新 Gemini API Key
INSERT INTO system_config (config_key, config_value, description, config_type)
VALUES ('api_key_gemini', 'AIzaSyCfiatVJW2YFm8pHTj_HIOhKeoJpDgwJws', 'Google Gemini API Key', 'api')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    description = VALUES(description),
    config_type = VALUES(config_type),
    updated_at = NOW();

-- 3. 验证配置
SELECT config_key, config_value, config_type FROM system_config WHERE config_key LIKE 'api_key_%';
