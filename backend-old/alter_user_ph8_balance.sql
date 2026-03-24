-- MySQL 5.7/8.0 兼容的 SQL
-- 先检查字段是否存在，然后添加

-- 添加 user_nickname 字段（如果不存在）
SET @dbname = 'kbitai0302';
SET @tablename = 'user_ph8_balance';
SET @columnname = 'user_nickname';

SET @sql = CONCAT(
    'ALTER TABLE ', @tablename, 
    ' ADD COLUMN user_nickname VARCHAR(64) COMMENT "用户昵称" AFTER id'
);

SET @sqlexist = CONCAT(
    'SELECT COUNT(*) INTO @exists FROM information_schema.COLUMNS ',
    'WHERE TABLE_SCHEMA = "', @dbname, '" ',
    'AND TABLE_NAME = "', @tablename, '" ',
    'AND COLUMN_NAME = "', @columnname, '"'
);

PREPARE stmt FROM @sqlexist;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@exists = 0, @sql, 'SELECT "user_nickname 字段已存在" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加 user_email 字段（如果不存在）
SET @columnname = 'user_email';

SET @sql = CONCAT(
    'ALTER TABLE ', @tablename, 
    ' ADD COLUMN user_email VARCHAR(128) COMMENT "用户邮箱" AFTER user_nickname'
);

SET @sqlexist = CONCAT(
    'SELECT COUNT(*) INTO @exists FROM information_schema.COLUMNS ',
    'WHERE TABLE_SCHEMA = "', @dbname, '" ',
    'AND TABLE_NAME = "', @tablename, '" ',
    'AND COLUMN_NAME = "', @columnname, '"'
);

PREPARE stmt FROM @sqlexist;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@exists = 0, @sql, 'SELECT "user_email 字段已存在" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加索引
ALTER TABLE user_ph8_balance 
ADD INDEX idx_user_email (user_email),
ADD INDEX idx_user_nickname (user_nickname);
