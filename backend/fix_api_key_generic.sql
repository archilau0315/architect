-- 修复 API Key 配置（通用版本）
-- 自动适应不同的表结构

-- 1. 检查 system_config 表是否存在
SHOW TABLES LIKE 'system_config';

-- 2. 查看表结构
DESCRIBE system_config;

-- 3. 检查是否存在 api_key_ph8 配置
SELECT * FROM system_config WHERE config_key = 'api_key_ph8';

-- 4. 检查是否存在 api_key_gemini 配置
SELECT * FROM system_config WHERE config_key = 'api_key_gemini';

-- 5. 根据表结构执行插入或更新操作
-- 注意：请根据实际表结构选择合适的语句执行

-- 方案1：如果表有 config_type 字段
-- INSERT INTO system_config (config_key, config_value, description, config_type)
-- VALUES ('api_key_ph8', 'sk-2f6ff8aba4d541d591d17e8eae60e75c', 'PH8.co API Key', 'api')
-- ON DUPLICATE KEY UPDATE 
--     config_value = VALUES(config_value),
--     description = VALUES(description),
--     config_type = VALUES(config_type),
--     updated_at = NOW();

-- INSERT INTO system_config (config_key, config_value, description, config_type)
-- VALUES ('api_key_gemini', 'AIzaSyCfiatVJW2YFm8pHTj_HIOhKeoJpDgwJws', 'Google Gemini API Key', 'api')
-- ON DUPLICATE KEY UPDATE 
--     config_value = VALUES(config_value),
--     description = VALUES(description),
--     config_type = VALUES(config_type),
--     updated_at = NOW();

-- 方案2：如果表没有 config_type 字段
-- INSERT INTO system_config (config_key, config_value, description)
-- VALUES ('api_key_ph8', 'sk-2f6ff8aba4d541d591d17e8eae60e75c', 'PH8.co API Key')
-- ON DUPLICATE KEY UPDATE 
--     config_value = VALUES(config_value),
--     description = VALUES(description),
--     updated_at = NOW();

-- INSERT INTO system_config (config_key, config_value, description)
-- VALUES ('api_key_gemini', 'AIzaSyCfiatVJW2YFm8pHTj_HIOhKeoJpDgwJws', 'Google Gemini API Key')
-- ON DUPLICATE KEY UPDATE 
--     config_value = VALUES(config_value),
--     description = VALUES(description),
--     updated_at = NOW();

-- 6. 验证配置
SELECT config_key, config_value FROM system_config WHERE config_key LIKE 'api_key_%';
