-- ============================================
-- 创建数据库视图兼容旧代码
-- ============================================

USE kbitai0302;

-- ============================================
-- 1. users 视图 (映射到 kbit_users)
-- ============================================
CREATE OR REPLACE VIEW users AS
SELECT 
    id as user_id,
    email,
    password_hash,
    nickname,
    avatar_url,
    user_tier as tier,
    tier_expires_at,
    daily_points as daily_quota,
    0 as daily_used,
    purchased_points as total_points,
    status,
    email_verified,
    phone_verified,
    last_login_at,
    last_login_ip,
    created_at,
    updated_at,
    CURDATE() as last_reset_date
FROM kbit_users;

-- ============================================
-- 2. token_usage 视图 (映射到 kbit_usage_logs)
-- =================================