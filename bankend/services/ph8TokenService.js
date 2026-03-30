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
    // 映射 request_type 到 feature
    const featureMap = {
      'image': 'image_gen',
      'video': 'video_gen',
      'chat': 'chat',
      'audio': 'chat',
      'enhance': 'prompt_enhance',
      'analyze': 'image_analyze'
    };
    const feature = featureMap[data.requestType] || data.requestType || 'chat';

    await db.query(
      'INSERT INTO kbit_usage_logs (user_id, request_id, feature, model_id, channel_id, prompt_tokens, completion_tokens, total_tokens, points_cost, actual_cost, status, error_message, latency_ms, ip_address, cache_hit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [
        data.userId,
        data.requestId || uuidv4(),
        feature,
        data.model,
        'hp8-accelerator',
        data.promptTokens || 0,
        data.completionTokens || 0,
        data.totalTokens,
        0, // points_cost - 后续计算
        0, // actual_cost
        data.status || 'success',
        data.errorMessage || null,
        data.responseTimeMs || 0,
        data.ipAddress || null,
        data.cachedTokens > 0 ? 1 : 0
      ]
    );

    console.log(`[PH8 Token] 记录成功: user=${data.userId}, tokens=${data.totalTokens}`);
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
    
    // 更新 kbit_users 表中的累计使用量
    await db.query(
      `UPDATE kbit_users 
       SET total_consumed_points = total_consumed_points + ?,
           updated_at = NOW()
       WHERE email = ? OR id = ?`,
      [points, userId, userId]
    );
    
    console.log(`[PH8 Token] 扣除余额: user=${userId}, tokens=${tokens}, points=${points}`);
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
    // 更新 kbit_users 表的 purchased_points 字段
    await db.query(
      `UPDATE kbit_users 
       SET purchased_points = purchased_points + ?,
           updated_at = NOW()
       WHERE email = ? OR id = ?`,
      [amount, userId, userId]
    );
    
    console.log(`[PH8 Token] 充值成功: user=${userId}, amount=${amount}`);
    return true;
  } catch (err) {
    console.error('[PH8 Token] 充值失败:', err);
    return false;
  }
}

/**
 * 获取用户余额（从 kbit_usage_logs 表实时统计）
 * @param {string} userId - 用户ID
 * @returns {Promise<Object|null>} - 余额信息
 */
async function getUserBalance(userId) {
  try {
    // 1. 获取用户基本信息（从 kbit_users 表）
    const [userRows] = await db.query(
      'SELECT nickname, email, purchased_points, total_consumed_points FROM kbit_users WHERE email = ? OR id = ?',
      [userId, userId]
    );
    
    const userNickname = userRows.length > 0 ? userRows[0].nickname : null;
    const userEmail = userRows.length > 0 ? userRows[0].email : userId;
    const purchasedPoints = userRows.length > 0 ? userRows[0].purchased_points : 0;
    const totalConsumedPoints = userRows.length > 0 ? userRows[0].total_consumed_points : 0;
    
    // 2. 实时统计今日使用（从 kbit_usage_logs 表）
    const [todayStats] = await db.query(
      `SELECT 
        COALESCE(SUM(total_tokens), 0) as totalTokens,
        COUNT(*) as requestCount
       FROM kbit_usage_logs 
       WHERE user_id = ? 
       AND DATE(created_at) = CURDATE()`,
      [userId]
    );
    
    // 3. 实时统计本月使用（从 kbit_usage_logs 表）
    const [monthStats] = await db.query(
      `SELECT 
        COALESCE(SUM(total_tokens), 0) as totalTokens,
        COUNT(*) as requestCount
       FROM kbit_usage_logs 
       WHERE user_id = ? 
       AND YEAR(created_at) = YEAR(CURDATE()) 
       AND MONTH(created_at) = MONTH(CURDATE())`,
      [userId]
    );
    
    // 4. 实时统计累计使用（从 kbit_usage_logs 表）
    const [totalStats] = await db.query(
      `SELECT 
        COALESCE(SUM(total_tokens), 0) as totalTokens,
        COUNT(*) as requestCount
       FROM kbit_usage_logs 
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
      totalBalance: purchasedPoints,
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
      totalRequestCount: totalStats.requestCount || 0
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
        AVG(latency_ms) as avgResponseTime
       FROM kbit_usage_logs 
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
      `SELECT * FROM kbit_usage_logs 
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