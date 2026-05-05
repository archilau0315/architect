-- ============================================
-- 完整的数据库表结构修复脚本
-- 说明：确保 kbit_users 表包含所有必需字段
-- ============================================

USE kbitai0302;

-- ============================================
-- 第一部分：添加缺失的字段（如果不存在）
-- ============================================

-- 1. 添加 tier_expires_at 字段（等级过期时间）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'tier_expires_at'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `tier_expires_at` DATETIME DEFAULT NULL COMMENT "等级过期时间" AFTER `user_tier`',
    'SELECT "tier_expires_at already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 添加 total_consumed_points 字段（累计消耗积分）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'total_consumed_points'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `total_consumed_points` DECIMAL(10,2) UNSIGNED NOT NULL DEFAULT 0.00 COMMENT "累计消耗积分"',
    'SELECT "total_consumed_points already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 添加 bonus_points 字段（赠送积分）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'bonus_points'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `bonus_points` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT "赠送积分"',
    'SELECT "bonus_points already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. 添加 purchased_points 字段（购买积分）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'purchased_points'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `purchased_points` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT "购买积分"',
    'SELECT "purchased_points already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. 添加 bonus_expires_at 字段（赠送积分过期时间）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'bonus_expires_at'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `bonus_expires_at` DATETIME DEFAULT NULL COMMENT "赠送积分过期时间"',
    'SELECT "bonus_expires_at already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. 添加 daily_points 字段（每日积分余额）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'daily_points'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `daily_points` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT "每日积分余额"',
    'SELECT "daily_points already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. 添加 daily_used 字段（今日已用积分）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'daily_used'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `daily_used` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT "今日已用积分"',
    'SELECT "daily_used already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. 添加 last_reset_date 字段（上次重置日期）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'last_reset_date'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `last_reset_date` DATE DEFAULT NULL COMMENT "上次重置日期"',
    'SELECT "last_reset_date already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 9. 添加 updated_at 字段（更新时间）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'updated_at'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT "更新时间"',
    'SELECT "updated_at already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 第二部分：字段兼容性检查
-- ============================================

-- 确保 user_tier 字段存在且有正确的数据类型
-- 如果不存在 tier 字段，尝试从旧字段迁移
SET @column_exists_tier = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'user_tier'
);
SET @column_exists_old_tier = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'tier'
);

SET @sql = IF(@column_exists_tier = 0 AND @column_exists_old_tier = 1,
    'ALTER TABLE `kbit_users` CHANGE COLUMN `tier` `user_tier` ENUM("free", "beta", "basic", "pro", "plus") NOT NULL DEFAULT "free" COMMENT "用户等级"',
    'SELECT "tier field already correct or not exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 如果 user_tier 完全不存在，添加它
SET @sql = IF(@column_exists_tier = 0 AND @column_exists_old_tier = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `user_tier` ENUM("free", "beta", "basic", "pro", "plus") NOT NULL DEFAULT "free" COMMENT "用户等级"',
    'SELECT "user_tier field is ok"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 第三部分：数据初始化与迁移
-- ============================================

-- 初始化 beta 用户的赠送积分为 1000（如果没有设置）
UPDATE `kbit_users` 
SET `bonus_points` = 1000,
    `bonus_expires_at` = DATE_ADD(NOW(), INTERVAL 30 DAY)
WHERE `user_tier` = 'beta' 
  AND `bonus_points` = 0 
  AND `total_points` > 0;

-- 初始化 daily_points：如果为空，设置为 daily_quota - daily_used
UPDATE `kbit_users` 
SET `daily_points` = GREATEST(0, `daily_quota` - `daily_used`)
WHERE `daily_points` = 0 
  AND `daily_quota` IS NOT NULL;

-- 如果没有 daily_quota 字段，根据等级设置默认值
SET @column_exists_quota = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'daily_quota'
);

SET @sql = IF(@column_exists_quota = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `daily_quota` INT UNSIGNED NOT NULL DEFAULT 200 COMMENT "每日积分限额"',
    'SELECT "daily_quota already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 初始化 daily_quota 根据用户等级
UPDATE `kbit_users`
SET `daily_quota` = CASE `user_tier`
    WHEN 'free' THEN 200
    WHEN 'beta' THEN 200
    WHEN 'basic' THEN 400
    WHEN 'pro' THEN 1500
    WHEN 'plus' THEN 2000
    ELSE 200
END;

-- ============================================
-- 验证执行结果
-- ============================================

-- 查看表结构
SELECT '=== 表结构验证 ===' AS message;
DESCRIBE `kbit_users`;

-- 查看用户数据
SELECT '=== 用户数据验证 ===' AS message;
SELECT id, email, user_tier, tier_expires_at, 
       daily_points, daily_quota, daily_used, 
       bonus_points, bonus_expires_at, purchased_points, 
       total_consumed_points, last_reset_date
FROM `kbit_users` 
LIMIT 10;
