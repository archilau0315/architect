/**
 * PH8 Token 记录服务模块
 * 用于记录 PH8 API 调用的 Token 消耗和更新用户余额
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db');

/**
 * 记录 Token 使用情况
 * @param {Object} data - 使用数据
 * @param {string} data.userId - 用户ID
 * @param {string} data.userNickname - 用户昵称
 * @param {string} data.userEmail - 用户邮箱
 * @param {string} data.requestId - PH8请求ID
 * @param {string} data.model - 使用的模型
 * @param {number} data.promptTokens - 输入token数
 * @param {number} data.completionTokens - 输出token数
 * @param {number} data.totalTokens - 总token数
 * @param {number} data.cachedTokens - 缓存token数
 * @param {string} data.requestType - 请求类型 (image/video/chat/audio)
 * @param {string} data.endpoint - API端点
 * @param {string} data.status - 请求状态
 * @param {string} data.errorMessage - 错误信息
 * @param {number} data.responseTimeMs - 响应时间
 * @param {string} data.ipAddress - 用户IP地址
 * @returns {Promise<boolean>} - 是否记录成功
 */
async function recordUsage(data) {
  try {
    const usageId = uuidv4();

    await db.query(
      'INSERT INTO ph8_token_usage (usage_id, user_id, user_nickname, user_email, request_id, model, prompt_tokens, completion_tokens, total_tokens, cached_tokens, request_type, endpoint, status, error_message, response_time_ms, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        usageId,
        data.userId,
        data.userNickname || null,
        data.userEmail || null,
        data.requestId || null,
        data.model,
        data.promptTokens || 0,
        data.completionTokens || 0,
        data.totalTokens,
        data.cachedTokens || 0,
        data.requestType,
        data.endpoint || null,
        data.status || 'success',
        data.errorMessage || null,
        data.responseTimeMs || null,
        data.ipAddress || null
      ]
    );

    console.log(`[PH8 Token] 记录成功: user=${data.userId}(${data.userNickname}), tokens=${data.totalTokens}`);
    return true;
  } catch (err) {
    console.error('[PH8 Token] 记录失败:', err);
    return false;
  }
}

/**
 * 更新用户余额（扣除Token，自动转换为积分）
 * @param {string} userId - 用户ID
 * @param {number} tokens - 扣除的Token数
 * @param {string} userNickname - 用户昵称（可选）
 * @param {string} userEmail - 用户邮箱（可选）
 * @returns {Promise<boolean>} - 是否更新成功
 */
async function deductBalance(userId, tokens, userNickname, userEmail) {
  try {
    // Token 到积分的换算比例：1 积分 = 150 token
    const TOKENS_PER_POINT = 150;
    const points = Math.ceil(tokens / TOKENS_PER_POINT);
    
    // 检查用户余额记录是否存在
    const [existing] = await db.query(
      'SELECT * FROM user_ph8_balance WHERE user_id = ?',
      [userId]
    );
    
    if (existing.length === 0) {
      // 创建新记录，包含昵称和邮箱
      await db.query(
        `INSERT INTO user_ph8_balance 
         (user_id, user_nickname, user_email, total_balance, used_today, used_this_month, total_used, last_request_at)
         VALUES (?, ?, ?, 0, ?, ?, ?, NOW())`,
        [userId, userNickname || null, userEmail || null, points, points, points]
      );
    } else {
      // 更新现有记录（存储的是积分），同时更新昵称和邮箱（如果有提供）
      const updateFields = [
        'used_today = used_today + ?',
        'used_this_month = used_this_month + ?',
        'total_used = total_used + ?',
        'last_request_at = NOW()'
      ];
      const params = [points, points, points];
      
      if (userNickname) {
        updateFields.push('user_nickname = ?');
        params.push(userNickname);
      }
      if (userEmail) {
        updateFields.push('user_email = ?');
        params.push(userEmail);
      }
      
      params.push(userId);
      
      await db.query(
        `UPDATE user_ph8_balance 
         SET ${updateFields.join(', ')}
         WHERE user_id = ?`,
        params
      );
    }
    
    console.log(`[PH8 Token] 扣除余额: user=${userId}(${userNickname}), tokens=${tokens}, points=${points}`);
    return true;
  } catch (err) {
    console.error('[PH8 Token] 扣除余额失败:', err);
    return false;
  }
}

/**
 * 充值用户余额
 * @param {string} userId - 用户ID
 * @param {number} amount - 充值金额
 * @returns {Promise<boolean>} - 是否充值成功
 */
async function rechargeBalance(userId, amount) {
  try {
    const [existing] = await db.query(
      'SELECT * FROM user_ph8_balance WHERE user_id = ?',
      [userId]
    );
    
    if (existing.length === 0) {
      await db.query(
        `INSERT INTO user_ph8_balance 
         (user_id, total_balance, used_today, used_this_month, total_used)
         VALUES (?, ?, 0, 0, 0)`,
        [userId, amount]
      );
    } else {
      await db.query(
        'UPDATE user_ph8_balance SET total_balance = total_balance + ? WHERE user_id = ?',
        [amount, userId]
      );
    }
    
    console.log(`[PH8 Token] 充值成功: user=${userId}, amount=${amount}`);
    return true;
  } catch (err) {
    console.error('[PH8 Token] 充值失败:', err);
    return false;
  }
}

/**
 * 获取用户余额（从 ph8_token_usage 表实时统计）
 * @param {string} userId - 用户ID
 * @returns {Promise<Object|null>} - 余额信息
 */
async function getUserBalance(userId) {
  try {
    // 1. 获取用户基本信息（从 users 表）
    const [userRows] = await db.query(
      'SELECT nickname, email FROM users WHERE user_id = ? OR email = ?',
      [userId, userId]
    );
    
    const userNickname = userRows.length > 0 ? userRows[0].nickname : null;
    const userEmail = userRows.length > 0 ? userRows[0].email : userId;
    
    // 2. 获取总充值金额（从 user_ph8_balance 表）
    const [balanceRows] = await db.query(
      'SELECT total_balance, last_request_at, last_reset_daily, last_reset_monthly FROM user_ph8_balance WHERE user_id = ?',
      [userId]
    );
    
    const totalBalance = balanceRows.length > 0 ? balanceRows[0].total_balance : 0;
    const lastRequestAt = balanceRows.length > 0 ? balanceRows[0].last_request_at : null;
    const lastResetDaily = balanceRows.length > 0 ? balanceRows[0].last_reset_daily : null;
    const lastResetMonthly = balanceRows.length > 0 ? balanceRows[0].last_reset_monthly : null;
    
    // 3. 实时统计今日使用（从 ph8_token_usage 表）
    // 使用 UTC 日期避免时区问题
    const now = new Date();
    const todayUTC = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const [todayStats] = await db.query(
      `SELECT 
        COALESCE(SUM(total_tokens), 0) as totalTokens,
        COUNT(*) as requestCount
       FROM ph8_token_usage 
       WHERE user_id = ? 
       AND DATE(CONVERT_TZ(created_at, '+00:00', '+08:00')) = ?`,
      [userId, todayUTC]
    );
    
    // 4. 实时统计本月使用（从 ph8_token_usage 表）
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const [monthStats] = await db.query(
      `SELECT 
        COALESCE(SUM(total_tokens), 0) as totalTokens,
        COUNT(*) as requestCount
       FROM ph8_token_usage 
       WHERE user_id = ? 
       AND YEAR(CONVERT_TZ(created_at, '+00:00', '+08:00')) = ? 
       AND MONTH(CONVERT_TZ(created_at, '+00:00', '+08:00')) = ?`,
      [userId, currentYear, currentMonth]
    );
    
    // 5. 实时统计累计使用（从 ph8_token_usage 表）
    const [totalStats] = await db.query(
      `SELECT 
        COALESCE(SUM(total_tokens), 0) as totalTokens,
        COUNT(*) as requestCount
       FROM ph8_token_usage 
       WHERE user_id = ?`,
      [userId]
    );
    
    // Token 到积分的换算比例
    const TOKENS_PER_POINT = 150;
    
    // 将 token 转换为积分
    const usedTodayPoints = Math.ceil((todayStats.totalTokens || 0) / TOKENS_PER_POINT);
    const usedThisMonthPoints = Math.ceil((monthStats.totalTokens || 0) / TOKENS_PER_POINT);
    const totalUsedPoints = Math.ceil((totalStats.totalTokens || 0) / TOKENS_PER_POINT);
    
    return {
      userId,
      userNickname,
      userEmail,
      // 积分单位（基于充值）
      totalBalance,
      // 积分单位（基于实际使用统计）
      usedToday: usedTodayPoints,
      usedThisMonth: usedThisMonthPoints,
      totalUsed: totalUsedPoints,
      // Token 单位（原始数据）
      usedTodayTokens: todayStats.totalTokens || 0,
      usedThisMonthTokens: monthStats.totalTokens || 0,
      totalUsedTokens: totalStats.totalTokens || 0,
      // 请求次数
      todayRequestCount: todayStats.requestCount || 0,
      monthRequestCount: monthStats.requestCount || 0,
      totalRequestCount: totalStats.requestCount || 0,
      // 时间信息
      lastRequestAt,
      lastResetDaily,
      lastResetMonthly
    };
  } catch (err) {
    console.error('[PH8 Token] 获取余额失败:', err);
    return null;
  }
}

/**
 * 获取用户使用统计
 * @param {string} userId - 用户ID
 * @param {Date} startDate - 开始日期
 * @param {Date} endDate - 结束日期
 * @returns {Promise<Object|null>} - 统计信息
 */
async function getUserUsageStats(userId, startDate, endDate) {
  try {
    const [rows] = await db.query(
      `SELECT 
        COUNT(*) as requestCount,
        SUM(total_tokens) as totalTokens,
        SUM(prompt_tokens) as promptTokens,
        SUM(completion_tokens) as completionTokens,
        AVG(response_time_ms) as avgResponseTime
       FROM ph8_token_usage 
       WHERE user_id = ? 
       AND created_at BETWEEN ? AND ?`,
      [userId, startDate, endDate]
    );
    
    return rows[0];
  } catch (err) {
    console.error('[PH8 Token] 获取统计失败:', err);
    return null;
  }
}

/**
 * 获取用户使用记录
 * @param {string} userId - 用户ID
 * @param {number} limit - 限制条数
 * @param {number} offset - 偏移量
 * @returns {Promise<Array>} - 使用记录列表
 */
async function getUserUsageHistory(userId, limit = 50, offset = 0) {
  try {
    const [rows] = await db.query(
      `SELECT * FROM ph8_token_usage 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    
    return rows;
  } catch (err) {
    console.error('[PH8 Token] 获取历史记录失败:', err);
    return [];
  }
}

/**
 * 重置每日使用计数
 * @returns {Promise<boolean>}
 */
async function resetDailyUsage() {
  try {
    await db.query(
      `UPDATE user_ph8_balance 
       SET used_today = 0, last_reset_daily = NOW()`
    );
    
    console.log('[PH8 Token] 每日使用计数已重置');
    return true;
  } catch (err) {
    console.error('[PH8 Token] 重置每日计数失败:', err);
    return false;
  }
}

/**
 * 重置每月使用计数
 * @returns {Promise<boolean>}
 */
async function resetMonthlyUsage() {
  try {
    await db.query(
      `UPDATE user_ph8_balance 
       SET used_this_month = 0, last_reset_monthly = NOW()`
    );
    
    console.log('[PH8 Token] 每月使用计数已重置');
    return true;
  } catch (err) {
    console.error('[PH8 Token] 重置每月计数失败:', err);
    return false;
  }
}

/**
 * 记录 API 调用日志
 * @param {Object} data - 日志数据
 * @returns {Promise<boolean>}
 */
async function logApiCall(data) {
  try {
    const logId = uuidv4();

    await db.query(
      `INSERT INTO ph8_api_logs
       (log_id, user_id, user_nickname, user_email, endpoint, request_body, response_body, status_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        data.userId,
        data.userNickname || null,
        data.userEmail || null,
        data.endpoint,
        data.requestBody || null,
        data.responseBody || null,
        data.statusCode || null
      ]
    );

    return true;
  } catch (err) {
    console.error('[PH8 Token] 记录API日志失败:', err);
    return false;
  }
}

module.exports = {
  recordUsage,
  deductBalance,
  rechargeBalance,
  getUserBalance,
  getUserUsageStats,
  getUserUsageHistory,
  resetDailyUsage,
  resetMonthlyUsage,
  logApiCall
};