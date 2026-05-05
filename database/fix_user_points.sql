-- ============================================
-- 用户积分数据修复脚本
-- 修复用户：啄之堂 (172392827@qq.com)
-- ============================================

USE kbitai0302;

-- 1. 查看用户当前数据
SELECT id, email, nickname, user_tier, daily_points, bonus_points, purchased_points, total_consumed_points, daily_used, last_reset_date 
FROM kbit_users 
WHERE email = '172392827@qq.com';

-- 2. 查看用户的使用日志
SELECT * FROM kbit_usage_logs 
WHERE user_id = 13 
ORDER BY created_at DESC;

-- 3. 重新计算用户的实际消耗积分
SELECT SUM(points_cost) AS total_consumed FROM kbit_usage_logs WHERE user_id = 13;

-- 4. 修复用户积分数据
-- 根据日志：生图14积分 + 视频30积分 = 44积分
UPDATE kbit_users 
SET 
  total_consumed_points = 44,
  daily_used = 44,
  daily_points = GREATEST(0, daily_quota - 44),
  updated_at = NOW()
WHERE email = '172392827@qq.com';

-- 5. 更新未识别记录的用户ID
-- 将用户ID为0或null的记录关联到正确的用户
UPDATE kbit_usage_logs 
SET user_id = 13 
WHERE user_id = 0 AND ip_address = '::ffff:127.0.0.1';

-- 6. 验证修复结果
SELECT id, email, nickname, user_tier, daily_points, bonus_points, purchased_points, total_consumed_points, daily_used 
FROM kbit_users 
WHERE email = '172392827@qq.com';

-- 7. 查看修复后的使用日志
SELECT * FROM kbit_usage_logs 
WHERE user_id = 13 
ORDER BY created_at DESC;
