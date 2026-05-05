const { v4: uuidv4 } = require('uuid');
const db = require('../db');

async function recordUsage(data) {
  try {
    const featureMap = {
      'image': 'image_gen', 'video': 'video_gen', 'chat': 'chat',
      'audio': 'chat', 'enhance': 'prompt_enhance', 'analyze': 'image_analyze'
    };
    const rawFeature = data.requestType || '';
    const feature = featureMap[rawFeature] || rawFeature || 'chat';
    const dbModel = data.model || data.modelId || 'unknown';

    let dbUserId = 0;
    if (data.userId && data.userId !== 'guest' && data.userId !== '0' && data.userId !== '未识别') {
      if (typeof data.userId === 'number') dbUserId = data.userId;
      else if (/^\d+$/.test(data.userId)) dbUserId = parseInt(data.userId);
      else dbUserId = data.userId;
    }

    let actualCost = parseFloat(data.cost) || 0;
    const points = Math.round(actualCost * 1000);

    await db.query(
      'INSERT INTO kbit_usage_logs (user_id, request_id, feature, model_id, channel_id, prompt_tokens, completion_tokens, total_tokens, points_cost, actual_cost, status, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [dbUserId, data.requestId || uuidv4(), feature, dbModel, data.channelId || 'default',
       data.promptTokens || 0, data.completionTokens || 0, data.totalTokens, points,
       actualCost, data.status || 'success', data.ipAddress || '']
    );
    console.log(`[PH8 Token] 记录成功: user=${data.userId}, points=${points}`);
    return true;
  } catch (err) {
    console.error('[PH8 Token] 记录失败:', err);
    return false;
  }
}

async function deductBalance(userId, cost, nickname, email) {
  try {
    const points = Math.round(cost * 1000);
    const userIdStr = String(userId);
    const isNumericId = !isNaN(userIdStr) && userIdStr.trim() !== '';
    const queryValue = isNumericId ? parseInt(userIdStr) : userIdStr;
    const whereCondition = isNumericId ? 'id = ?' : 'email = ?';

    const [userRows] = await db.query(
      `SELECT total_earned, total_points, daily_quota, daily_used, daily_reset_at
       FROM kbit_users WHERE ${whereCondition}`, [queryValue]
    );

    if (userRows.length === 0) {
      console.error('[PH8 Token] 用户不存在:', userId);
      return false;
    }

    const user = userRows[0];
    let { total_points, daily_quota, daily_used, daily_reset_at } = user;

    const today = new Date().toISOString().split('T')[0];
    if (daily_reset_at !== today || daily_reset_at === null) {
      daily_used = 0;
      await db.query(`UPDATE kbit_users SET daily_used = 0, daily_reset_at = ? WHERE ${whereCondition}`, [today, queryValue]);
    }

    const dailyRemaining = Math.max(0, daily_quota - daily_used);
    let deductFromDaily = Math.min(points, dailyRemaining);
    let deductFromTotal = Math.max(0, points - deductFromDaily);
    const newDailyUsed = daily_used + deductFromDaily;

    await db.query(
      `UPDATE kbit_users
       SET total_points = GREATEST(0, total_points - ?),
           daily_used = ?,
           updated_at = NOW()
       WHERE ${whereCondition}`,
      [deductFromTotal, newDailyUsed, queryValue]
    );

    console.log('[PH8 Token] 扣减详情:', {
      userId, nickname: nickname || '未知', email: email || '',
      cost, points,
      deductFromDaily, deductFromTotal,
      remainingBalance: (total_points || 0) - deductFromTotal,
      remainingDaily: dailyRemaining - deductFromDaily
    });
    return true;
  } catch (err) {
    console.error('[PH8 Token] 扣除失败:', err);
    return false;
  }
}

async function rechargeBalance(userId, amount) {
  try {
    const userIdStr = String(userId);

    let q = `UPDATE kbit_users SET total_earned = total_earned + ?, total_points = total_points + ?, updated_at = NOW() WHERE email = ?`;
    let p = [amount, amount, userIdStr];

    if (!isNaN(userIdStr) && userIdStr.trim() !== '') {
      q = `UPDATE kbit_users SET total_earned = total_earned + ?, total_points = total_points + ?, updated_at = NOW() WHERE email = ? OR id = ?`;
      p = [amount, amount, userIdStr, parseInt(userIdStr)];
    }

    await db.query(q, p);
    console.log(`[PH8 Token] 充值成功: user=${userId}, amount=${amount}`);
    return true;
  } catch (err) {
    console.error('[PH8 Token] 充值失败:', err);
    return false;
  }
}

async function getUserBalance(userId) {
  try {
    const userIdStr = String(userId);
    let q = 'SELECT nickname, email, total_earned, total_points, daily_quota, daily_used, daily_reset_at FROM kbit_users WHERE email = ?';
    let p = [userIdStr];
    if (!isNaN(userIdStr) && userIdStr.trim() !== '') {
      q = 'SELECT nickname, email, total_earned, total_points, daily_quota, daily_used, daily_reset_at FROM kbit_users WHERE email = ? OR id = ?';
      p = [userIdStr, parseInt(userIdStr)];
    }

    let userRows = [];
    try { [userRows] = await db.query(q, p); } catch (e) { console.error('[查询用户失败]', e); }

    const totalEarned = userRows.length > 0 ? (userRows[0].total_earned || 0) : 0;
    const totalPoints = userRows.length > 0 ? (userRows[0].total_points || 0) : 0;
    const dailyQuota = userRows.length > 0 ? (userRows[0].daily_quota || 200) : 200;
    const dailyUsed = userRows.length > 0 ? (userRows[0].daily_used || 0) : 0;
    const dailyRemaining = Math.max(0, dailyQuota - dailyUsed);
    const consumedTotal = totalEarned - totalPoints;

    let todayStats = { totalTokens: 0, requestCount: 0 };
    try {
      [todayStats] = await db.query(
        `SELECT COALESCE(SUM(points_cost),0) as totalTokens, COUNT(*) as requestCount 
         FROM kbit_usage_logs WHERE user_id=? AND DATE(created_at)=CURDATE()`, [userId]);
    } catch (_) {}

    let monthStats = { totalTokens: 0 };
    try {
      [monthStats] = await db.query(
        `SELECT COALESCE(SUM(points_cost),0) as totalTokens FROM kbit_usage_logs 
         WHERE user_id=? AND YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())`, [userId]);
    } catch (_) {}

    let totalStats = { totalTokens: 0 };
    try {
      [totalStats] = await db.query(
        `SELECT COALESCE(SUM(points_cost),0) as totalTokens FROM kbit_usage_logs WHERE user_id=?`, [userId]);
    } catch (_) {}

    return {
      userId,
      userNickname: userRows.length > 0 ? userRows[0].nickname : null,
      userEmail: userRows.length > 0 ? userRows[0].email : userId,

      totalPoints: totalEarned,
      balance: totalPoints,
      consumedTotal: consumedTotal,

      dailyQuota: dailyQuota,
      dailyRemaining: dailyRemaining,
      dailyUsed: dailyUsed,

      usedToday: Math.ceil(todayStats.totalTokens || 0),
      usedThisMonth: Math.ceil(monthStats.totalTokens || 0),
      usedAllTime: Math.ceil(totalStats.totalTokens || 0),

      todayRequestCount: todayStats.requestCount || 0
    };
  } catch (err) {
    console.error('[PH8 Token] 获取余额失败:', err);
    return { userId, totalPoints: 0, balance: 0, consumedTotal: 0, dailyQuota:200, dailyRemaining:200, dailyUsed:0, usedToday:0, usedThisMonth:0, usedAllTime:0 };
  }
}

async function getUserUsageStats(userId, startDate, endDate) {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) as requestCount, SUM(total_tokens) as totalTokens,
              SUM(prompt_tokens) as promptTokens, SUM(completion_tokens) as completionTokens
       FROM kbit_usage_logs WHERE user_id=? AND created_at BETWEEN ? AND ?`,
      [userId, startDate, endDate]);
    return rows[0];
  } catch (err) { console.error(err); return null; }
}

async function getUserUsageHistory(userId, limit = 50, offset = 0) {
  try {
    const [rows] = await db.query(
      `SELECT * FROM kbit_usage_logs WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]);
    return rows;
  } catch (err) { console.error(err); return []; }
}

async function checkTierExpiry() {
  try {
    const [expiredUsers] = await db.query(
      `SELECT id,email,nickname,user_tier,tier_expires_at FROM kbit_users 
       WHERE tier_expires_at IS NOT NULL AND tier_expires_at < NOW() AND user_tier!='free' AND status=1`);
    if (!expiredUsers.length) return { downgraded:0, skipped:0 };

    let n = 0;
    for (const u of expiredUsers) {
      await db.query(`UPDATE kbit_users SET user_tier='free',tier_expires_at=NULL,daily_quota=200,updated_at=NOW() WHERE id=?`, [u.id]);
      n++;
    }
    return { downgraded:n, skipped: expiredUsers.length-n };
  } catch (err) { console.error(err); return { downgraded:0, skipped:0 }; }
}

async function checkUserTierExpiry(userId) {
  try {
    const [users] = await db.query(`SELECT id,user_tier,tier_expires_at FROM kbit_users WHERE id=?`, [userId]);
    if (!users.length) return null;
    const u = users[0];
    if (u.user_tier==='free' || !u.tier_expires_at) return { expired:false, previousTier:u.user_tier, currentTier:u.user_tier };
    if (new Date(u.tier_expires_at) <= new Date()) {
      await db.query(`UPDATE kbit_users SET user_tier='free',tier_expires_at=NULL,daily_quota=200,updated_at=NOW() WHERE id=?`, [userId]);
      return { expired:true, previousTier:u.user_tier, currentTier:'free' };
    }
    return { expired:false, previousTier:u.user_tier, currentTier:u.user_tier };
  } catch (err) { console.error(err); return null; }
}

async function resetDailyUsage() {
  try {
    await checkTierExpiry();
    await db.query(`UPDATE kbit_users SET daily_used=0, daily_reset_at=CURDATE(), updated_at=NOW()`);
    return true;
  } catch (err) { console.error(err); return false; }
}

async function resetMonthlyUsage() { return true; }

async function logApiCall(data) {
  try {
    await db.query(
      `INSERT INTO ph8_api_logs (log_id,user_id,user_nickname,user_email,endpoint,request_body,response_body,status_code) VALUES (?,?,?,?,?,?,?,?)`,
      [uuidv4(), data.userId, data.userNickname||null, data.userEmail||null, data.endpoint, data.requestBody||null, data.responseBody||null, data.statusCode||null]);
    return true;
  } catch (err) { console.error(err); return false; }
}

module.exports = {
  recordUsage, deductBalance, rechargeBalance, getUserBalance,
  getUserUsageStats, getUserUsageHistory, checkTierExpiry, checkUserTierExpiry,
  resetDailyUsage, resetMonthlyUsage, logApiCall
};
