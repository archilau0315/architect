-- 修复 API Key 配置（版本2）
-- 适应现有表结构

-- 1. 查看现有表结构
DESCRIBE system_config;

-- 2. 检查并添加 PH8 API Key
-- 注意：如果您有自己的 PH8 API Key，请替换下面的值
INSERT INTO system_config (config_key, config_value, description, config_type)
VALUES ('api_key_ph8', 'sk-2f6ff8aba4d541d591d17e8eae60e75c', 'PH8.co API Key', 'api')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    description = VALUES(description),
    config_type = VALUES(config_type),
    updated_at = NOW();

-- 3. 检查并添加 Gemini API Key
-- 注意：如果您有自己的 Gemini API Key，请替换下面的值
INSERT INTO system_config (config_key, config_value, description, config_type)
VALUES ('api_key_gemini', 'AIzaSyCfiatVJW2YFm8pHTj_HIOhKeoJpDgwJws', 'Google Gemini API Key', 'api')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    description = VALUES(description),
    config_type = VALUES(config_type),
    updated_at = NOW();

-- 4. 查看当前配置
SELECT config_key, config_value, config_type FROM system_config WHERE config_key LIKE 'api_key_%';

-- 5. 验证配置
SELECT 'API Key 配置完成' AS message, 
       COUNT(*) AS total_configs 
FROM system_config WHERE config_key LIKE 'api_key_%';
