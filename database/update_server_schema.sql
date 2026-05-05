-- ============================================
-- 服务器数据库增量更新脚本
-- 说明：添加积分体系必需的缺失字段
-- ============================================

USE kbitai0302;

-- 添加 total_consumed_points 字段（累计消耗积分）
-- 用于计算总余额 = 总积分 - 累计消耗
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'total_consumed_points'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `total_consumed_points` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT "累计消耗积分" AFTER `total_points`',
    'SELECT "total_consumed_points already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 bonus_points 字段（赠送积分）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'bonus_points'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `bonus_points` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT "赠送积分" AFTER `total_consumed_points`',
    'SELECT "bonus_points already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 purchased_points 字段（购买积分）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'purchased_points'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `purchased_points` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT "购买积分" AFTER `bonus_points`',
    'SELECT "purchased_points already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 bonus_expires_at 字段（赠送积分过期时间）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'bonus_expires_at'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `bonus_expires_at` DATETIME DEFAULT NULL COMMENT "赠送积分过期时间" AFTER `purchased_points`',
    'SELECT "bonus_expires_at already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 daily_points 字段（每日积分余额）
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'kbitai0302'
    AND TABLE_NAME = 'kbit_users'
    AND COLUMN_NAME = 'daily_points'
);
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `kbit_users` ADD COLUMN `daily_points` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT "每日积分余额" AFTER `bonus_expires_at`',
    'SELECT "daily_points already exists, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 数据迁移：将现有数据迁移到新字段
-- ============================================

-- 1. 将 total_points 迁移到 bonus_points（对于 beta 用户，total_points 通常是赠送的1000积分）
--    对于其他用户，total_points 可能是购买积分，需要手动确认
UPDATE `kbit_users` 
SET 
    `bonus_points` = IF(`bonus_points` = 0 AND `tier` = 'beta', `total_points`, `bonus_points`),
    `purchased_points` = IF(`purchased_points` = 0 AND `tier` != 'beta', `total_points`, `purchased_points`)
WHERE `total_points` > 0;

-- 2. 初始化 daily_points = daily_quota - daily_used
UPDATE `kbit_users` 
SET `daily_points` = `daily_quota` - `daily_used`
WHERE `daily_points` = 0;

-- ============================================
-- 验证执行结果
-- ============================================

-- 查看表结构
DESCRIBE `kbit_users`;

-- 查看数据迁移结果
SELECT id, email, tier, total_points, bonus_points, purchased_points, daily_points, daily_quota, daily_used, total_consumed_points, last_reset_date FROM `kbit_users` LIMIT 10;
