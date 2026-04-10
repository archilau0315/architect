-- 修复 API Key 配置
-- 在 phpMyAdmin 中执行此脚本

-- 1. 检查并创建 system_config 表
CREATE TABLE IF NOT EXISTS system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(255) NOT NULL UNIQUE,
    config_value TEXT,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 2. 检查并添加 PH8 API Key
-- 注意：如果您有自己的 PH8 API Key，请替换下面的值
INSERT INTO system_config (config_key, config_value, description)
VALUES ('api_key_ph8', 'sk-2f6ff8aba4d541d591d17e8eae60e75c', 'PH8.co API Key')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    description = VALUES(description),
    updated_at = NOW();

-- 3. 检查并添加 Gemini API Key
-- 注意：如果您有自己的 Gemini API Key，请替换下面的值
INSERT INTO system_config (config_key, config_value, description)
VALUES ('api_key_gemini', 'AIzaSyCfiatVJW2YFm8pHTj_HIOhKeoJpDgwJws', 'Google Gemini API Key')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    description = VALUES(description),
    updated_at = NOW();

-- 4. 查看当前配置
SELECT config_key, config_value FROM system_config WHERE config_key LIKE 'api_key_%';

-- 5. 验证配置
SELECT 'API Key 配置完成' AS message, 
       COUNT(*) AS total_configs 
FROM system_config WHERE config_key LIKE 'api_key_%';
