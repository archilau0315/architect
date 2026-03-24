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
  const [existing] = await db.query(
    'SELECT * FROM user_quotas WHERE user_id = ?',
    [userId]
  );
  
  if (existing.length === 0) {
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    await db.query(
      `INSERT INTO user_quotas (user_id, tier, daily_token_limit, monthly_token_limit) VALUES (?, ?, ?, ?)`,
      [userId, tier, limits.dailyTokenLimit, limits.monthlyTokenLimit]
    );
    return {
      userId,
      tier,
      dailyTokensUsed: 0,
      monthlyTokensUsed: 0,
      dailyTokenLimit: limits.dailyTokenLimit,
      monthlyTokenLimit: limits.monthlyTokenLimit,
      isLimited: false
    };
  }
  
  return existing[0];
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
  
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  
  let dailyTokensUsed = quota.daily_tokens_used;
  let monthlyTokensUsed = quota.monthly_tokens_used;
  
  if (quota.last_reset_daily && quota.last_reset_daily.toISOString().split('T')[0] !== today) {
    dailyTokensUsed = 0;
    await db.query(
      'UPDATE user_quotas SET daily_tokens_used = 0, last_reset_daily = NOW() WHERE user_id = ?',
      [userId]
    );
  }
  
  if (quota.last_reset_monthly && quota.last_reset_monthly.toISOString().slice(0, 7) !== thisMonth) {
    monthlyTokensUsed = 0;
    await db.query(
      'UPDATE user_quotas SET monthly_tokens_used = 0, last_reset_monthly = NOW() WHERE user_id = ?',
      [userId]
    );
  }
  
  if (quota.is_limited && quota.limited_until && new Date() < new Date(quota.limited_until)) {
    return {
      allowed: false,
      reason: 'limited',
      message: '您的账户已被限流',
      limitedUntil: quota.limited_until,
      dailyTokensUsed,
      monthlyTokensUsed,
      dailyTokenLimit: quota.daily_token_limit,
      monthlyTokenLimit: quota.monthly_token_limit
    };
  }
  
  if (dailyTokensUsed >= quota.daily_token_limit) {
    return {
      allowed: false,
      reason: 'daily_limit',
      message: `今日Token额度已用完（${quota.daily_token_limit}），请明天再试`,
      dailyTokensUsed,
      monthlyTokensUsed,
      dailyTokenLimit: quota.daily_token_limit,
      monthlyTokenLimit: quota.monthly_token_limit
    };
  }
  
  if (monthlyTokensUsed >= quota.monthly_token_limit) {
    return {
      allowed: false,
      reason: 'monthly_limit',
      message: `本月Token额度已用完（${quota.monthly_token_limit}），请升级套餐或下月再试`,
      dailyTokensUsed,
      monthlyTokensUsed,
      dailyTokenLimit: quota.daily_token_limit,
      monthlyTokenLimit: quota.monthly_token_limit
    };
  }
  
  return {
    allowed: true,
    dailyTokensUsed,
    monthlyTokensUsed,
    dailyTokenLimit: quota.daily_token_limit,
    monthlyTokenLimit: quota.monthly_token_limit,
    remainingDaily: quota.daily_token_limit - dailyTokensUsed,
    remainingMonthly: quota.monthly_token_limit - monthlyTokensUsed
  };
}

async function getUserInfo(userId) {
  try {
    // 尝试从 users 表查询用户信息
    const [rows] = await db.query(
      'SELECT nickname, email FROM users WHERE user_id = ? OR email = ?',
      [userId, userId]
    );
    
    if (rows.length > 0) {
      return { 
        nickname: rows[0].nickname || (rows[0].email ? rows[0].email.split('@')[0] : '未知用户'), 
        email: rows[0].email || userId 
      };
    }
    
    // 如果用户不存在，尝试从 user_ph8_balance 表获取
    const [balanceRows] = await db.query(
      'SELECT * FROM user_ph8_balance WHERE user_id = ?',
      [userId]
    );
    
    if (balanceRows.length > 0) {
      return { 
        nickname: '未知用户', 
        email: userId 
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
  const today = new Date().toISOString().split('T')[0];

  await db.query(
    `INSERT INTO token_usage (user_id, request_id, model, prompt_tokens, completion_tokens, total_tokens, request_type, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, requestId, model, tokens.prompt || 0, tokens.completion || 0, tokens.total || 0, requestType, '']
  );
  
  await db.query(
    `UPDATE user_quotas 
     SET daily_tokens_used = daily_tokens_used + ?,
         monthly_tokens_used = monthly_tokens_used + ?,
         total_tokens_used = total_tokens_used + ?,
         request_count_today = request_count_today + 1,
         request_count_month = request_count_month + 1,
         last_request_at = NOW()
     WHERE user_id = ?`,
    [tokens.total || 0, tokens.total || 0, tokens.total || 0, userId]
  );
}

async function recordRateLimitEvent(userId, limitType, tokensAttempted, limitValue, currentValue) {
  await db.query(
    `INSERT INTO rate_limit_logs (user_id, limit_type, tokens_attempted, limit_value, current_value)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, limitType, tokensAttempted, limitValue, currentValue]
  );
  
  if (limitType === 'daily_token' || limitType === 'monthly_token') {
    await db.query(
      `UPDATE user_quotas SET is_limited = 1, limited_until = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE user_id = ?`,
      [userId]
    );
  }
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
  const [quota] = await db.query(
    'SELECT * FROM user_quotas WHERE user_id = ?',
    [userId]
  );
  
  const [todayUsage] = await db.query(
    `SELECT 
      SUM(total_tokens) as total_tokens,
      COUNT(*) as request_count
    FROM token_usage 
    WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  
  const [monthUsage] = await db.query(
    `SELECT 
      SUM(total_tokens) as total_tokens,
      COUNT(*) as request_count
    FROM token_usage 
    WHERE user_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`,
    [userId]
  );
  
  const [typeBreakdown] = await db.query(
    `SELECT 
      request_type,
      SUM(total_tokens) as tokens,
      COUNT(*) as count
    FROM token_usage 
    WHERE user_id = ? AND DATE(created_at) = CURDATE()
    GROUP BY request_type`,
    [userId]
  );
  
  return {
    quota: quota[0] || null,
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
