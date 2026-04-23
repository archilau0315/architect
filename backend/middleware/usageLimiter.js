const db = require('../db');

const TIER_LIMITS = {
  free: { dailyTokenLimit: 10000, monthlyTokenLimit: 300000, requestsPerMinute: 5, concurrentRequests: 2 },
  beta: { dailyTokenLimit: 50000, monthlyTokenLimit: 1500000, requestsPerMinute: 10, concurrentRequests: 3 },
  basic: { dailyTokenLimit: 100000, monthlyTokenLimit: 3000000, requestsPerMinute: 15, concurrentRequests: 5 },
  pro: { dailyTokenLimit: 300000, monthlyTokenLimit: 9000000, requestsPerMinute: 30, concurrentRequests: 10 },
  plus: { dailyTokenLimit: 1000000, monthlyTokenLimit: 30000000, requestsPerMinute: 60, concurrentRequests: 20 }
};

const requestCounts = new Map();
const concurrentCounts = new Map();

function cleanOldRequestCounts() {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.timestamp > 60000) {
      requestCounts.delete(key);
    }
  }
}

setInterval(cleanOldRequestCounts, 60000);

async function ensureUserQuota(userId, tier = 'free') {
  // 从 token_usage 实时统计今日/本月使用量
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  
  // 查询今日使用量
  const [todayStats] = await db.query(
    `SELECT COALESCE(SUM(total_tokens), 0) as totalTokens, COUNT(*) as requestCount
     FROM kbit_usage_logs 
     WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  
  // 查询本月使用量
  const [monthStats] = await db.query(
    `SELECT COALESCE(SUM(total_tokens), 0) as totalTokens, COUNT(*) as requestCount
     FROM kbit_usage_logs 
     WHERE user_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`,
    [userId]
  );
  
  return {
    userId,
    tier,
    dailyTokensUsed: todayStats[0]?.totalTokens || 0,
    monthlyTokensUsed: monthStats[0]?.totalTokens || 0,
    dailyTokenLimit: limits.dailyTokenLimit,
    monthlyTokenLimit: limits.monthlyTokenLimit,
    isLimited: false
  };
}

async function checkRateLimit(userId, tier = 'free') {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const now = Date.now();
  const minuteKey = `${userId}_${Math.floor(now / 60000)}`;
  
  const currentMinute = requestCounts.get(minuteKey) || { count: 0, timestamp: now };
  currentMinute.count++;
  requestCounts.set(minuteKey, currentMinute);
  
  if (currentMinute.count > limits.requestsPerMinute) {
    return {
      allowed: false,
      reason: 'rate_per_minute',
      message: `请求过于频繁，每分钟最多 ${limits.requestsPerMinute} 次请求`,
      retryAfter: 60 - (now % 60000) / 1000
    };
  }
  
  const currentConcurrent = concurrentCounts.get(userId) || 0;
  if (currentConcurrent >= limits.concurrentRequests) {
    return {
      allowed: false,
      reason: 'concurrent',
      message: `并发请求过多，最多同时 ${limits.concurrentRequests} 个请求`,
      retryAfter: 5
    };
  }
  
  return { allowed: true };
}

async function checkTokenLimit(userId) {
  const quota = await ensureUserQuota(userId);
  
  // 实时从 kbit_usage_logs 统计今日/本月使用量
  const [todayStats] = await db.query(
    `SELECT COALESCE(SUM(total_tokens), 0) as totalTokens
     FROM kbit_usage_logs 
     WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  
  const [monthStats] = await db.query(
    `SELECT COALESCE(SUM(total_tokens), 0) as totalTokens
     FROM kbit_usage_logs 
     WHERE user_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`,
    [userId]
  );
  
  const dailyTokensUsed = todayStats[0]?.totalTokens || 0;
  const monthlyTokensUsed = monthStats[0]?.totalTokens || 0;
  
  if (dailyTokensUsed >= quota.dailyTokenLimit) {
    return {
      allowed: false,
      reason: 'daily_limit',
      message: `今日Token额度已用完（${quota.dailyTokenLimit}），请明天再试`,
      dailyTokensUsed,
      monthlyTokensUsed,
      dailyTokenLimit: quota.dailyTokenLimit,
      monthlyTokenLimit: quota.monthlyTokenLimit
    };
  }
  
  if (monthlyTokensUsed >= quota.monthlyTokenLimit) {
    return {
      allowed: false,
      reason: 'monthly_limit',
      message: `本月Token额度已用完（${quota.monthlyTokenLimit}），请升级套餐或下月再试`,
      dailyTokensUsed,
      monthlyTokensUsed,
      dailyTokenLimit: quota.dailyTokenLimit,
      monthlyTokenLimit: quota.monthlyTokenLimit
    };
  }
  
  return {
    allowed: true,
    dailyTokensUsed,
    monthlyTokensUsed,
    dailyTokenLimit: quota.dailyTokenLimit,
    monthlyTokenLimit: quota.monthlyTokenLimit,
    remainingDaily: quota.dailyTokenLimit - dailyTokensUsed,
    remainingMonthly: quota.monthlyTokenLimit - monthlyTokensUsed
  };
}

async function getUserInfo(userId) {
  try {
    // 尝试从 kbit_users 表查询用户信息
    const [rows] = await db.query(
      'SELECT nickname, email FROM kbit_users WHERE id = ? OR email = ?',
      [userId, userId]
    );
    
    if (rows.length > 0) {
      return { 
        nickname: rows[0].nickname,
        email: rows[0].email
      };
    }
    
    // 都不存在，返回默认值
    return { nickname: '未知用户', email: userId };
  } catch (err) {
    console.error('[UsageLimiter] 获取用户信息失败:', err);
    return { nickname: '未知用户', email: userId };
  }
}

async function recordTokenUsage(userId, tokens, model, requestType, requestId = null) {
  // 映射 request_type 到 feature
  const featureMap = {
    'image': 'image_gen',
    'video': 'video_gen',
    'chat': 'chat',
    'audio': 'chat'
  };
  const rawFeature = requestType || '';
  const feature = featureMap[rawFeature] || rawFeature || 'chat';

  // 处理null/undefined用户ID → 0（数据库BIGINT UNSIGNED字段）
  const dbUserId = (userId != null && userId !== '') ? userId : 0;
  // 确保model永远有值
  const dbModel = model || 'unknown';

  // 写入 kbit_usage_logs 表
  await db.query(
    `INSERT INTO kbit_usage_logs (user_id, request_id, feature, model_id, channel_id, prompt_tokens, completion_tokens, total_tokens, points_cost, actual_cost, status, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [dbUserId, requestId || `req_${Date.now()}`, feature, dbModel, 'default', tokens.prompt || 0, tokens.completion || 0, tokens.total || 0, 0, 0, 'success', '']
  );
}

async function recordRateLimitEvent(userId, limitType, tokensAttempted, limitValue, currentValue) {
  // 限流事件记录到 kbit_usage_logs 表，状态为 failed
  console.log(`[RateLimit] 用户 ${userId} 触发限流: ${limitType}, 尝试使用 ${tokensAttempted} tokens, 限制 ${limitValue}`);
  
  // 可选：写入系统日志表或发送告警
  // 暂时不写入数据库，避免依赖旧表
}

function incrementConcurrent(userId) {
  const current = concurrentCounts.get(userId) || 0;
  concurrentCounts.set(userId, current + 1);
}

function decrementConcurrent(userId) {
  const current = concurrentCounts.get(userId) || 0;
  if (current > 0) {
    concurrentCounts.set(userId, current - 1);
  }
}

async function getUserUsageStats(userId) {
  // 从 kbit_usage_logs 实时统计使用量
  const [todayUsage] = await db.query(
    `SELECT 
      SUM(total_tokens) as total_tokens,
      COUNT(*) as request_count
    FROM kbit_usage_logs 
    WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  
  const [monthUsage] = await db.query(
    `SELECT 
      SUM(total_tokens) as total_tokens,
      COUNT(*) as request_count
    FROM kbit_usage_logs 
    WHERE user_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`,
    [userId]
  );
  
  const [typeBreakdown] = await db.query(
    `SELECT
      feature,
      SUM(total_tokens) as tokens,
      COUNT(*) as count
    FROM kbit_usage_logs
    WHERE user_id = ? AND DATE(created_at) = CURDATE()
    GROUP BY feature`,
    [userId]
  );
  
  return {
    quota: null,
    today: todayUsage[0] || { total_tokens: 0, request_count: 0 },
    month: monthUsage[0] || { total_tokens: 0, request_count: 0 },
    typeBreakdown: typeBreakdown || []
  };
}

module.exports = {
  TIER_LIMITS,
  ensureUserQuota,
  checkRateLimit,
  checkTokenLimit,
  recordTokenUsage,
  recordRateLimitEvent,
  incrementConcurrent,
  decrementConcurrent,
  getUserUsageStats
};
