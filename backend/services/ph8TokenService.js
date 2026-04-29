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
    // 确保feature永远不为undefined/null（防止数据库写入NULL）
    const rawFeature = data.requestType || '';
    const feature = featureMap[rawFeature] || rawFeature || 'chat';
    // 确保model永远不为undefined/null
    const dbModel = data.model || data.modelId || 'unknown';

    // 处理用户ID：null/undefined → 0（数据库BIGINT UNSIGNED字段）
    const dbUserId = data.userId != null ? data.userId : 0;

    // 计算费用：如果PH8 API返回了cost字段则使用，否则根据token数量估算
  let actualCost = data.cost || 0;
  
  if (actualCost === 0 && data.totalTokens > 0) {
    // PH8 定价：输入0.3元/百万token，输出0.6元/百万token
    // 估算费用
    const promptTokens = data.promptTokens || 0;
    const completionTokens = data.completionTokens || 0;
    actualCost = (promptTokens * 0.3 + completionTokens * 0.6) / 1000000;
  }
  
  // 计算积分：1元=1000积分，ph8消耗X元 → 扣用户 X×1000 积分
  const points = Math.round(actualCost * 1000);
  
  await db.query(
      'INSERT INTO kbit_usage_logs (user_id, request_id, feature, model_id, channel_id, prompt_tokens, completion_tokens, total_tokens, points_cost, actual_cost, status, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [
        dbUserId,
        data.requestId || uuidv4(),
        feature,
        dbModel,
        data.channelId || 'default', // 添加 channel_id 字段
        data.promptTokens || 0,
        data.completionTokens || 0,
        data.totalTokens,
        points, // 积分 = 费用（元） × 1000，四舍五入
        actualCost, // 实际成本(元)
        data.status || 'success',
        data.ipAddress || ''
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
async function deductBalance(userId, cost, userNickname, userEmail) {
  try {
    // PH8 返回的 cost 是实际费用（元）
    // 积分 = 费用（元） × 1000（1元=1000积分）
    const points = Math.round(cost * 1000);
    
    // 确保 userId 是字符串类型
    const userIdStr = String(userId);
    
    // 更新 kbit_users 表中的累计使用量
    let updateQuery;
    let updateParams;
    
    // 检查userId是否为数字
    if (!isNaN(userIdStr) && userIdStr.trim() !== '') {
      // 如果是数字，只匹配 id 字段
      updateQuery = `UPDATE kbit_users 
                      SET total_consumed_points = total_consumed_points + ?,
                          updated_at = NOW()
                      WHERE id = ?`;
      updateParams = [points, parseInt(userIdStr)];
    } else {
      // 如果是字符串，匹配 email 字段
      updateQuery = `UPDATE kbit_users 
                      SET total_consumed_points = total_consumed_points + ?,
                          updated_at = NOW()
                      WHERE email = ?`;
      updateParams = [points, userIdStr];
    }
    
    console.log('[PH8 Token] 更新用户积分:', {
      userId: userId,
      points: points,
      query: updateQuery,
      params: updateParams
    });
    
    const [result] = await db.query(updateQuery, updateParams);
    console.log('[PH8 Token] 更新结果:', result);
    
    console.log(`[PH8 Token] 扣除余额: user=${userId}, cost=${cost.toFixed(6)}元, points=${points}`);
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
    // 处理用户ID：如果是数字，按id匹配；否则按email匹配
    
    // 确保 userId 是字符串类型
    const userIdStr = String(userId);
    
    let rechargeQuery = `UPDATE kbit_users 
                        SET purchased_points = purchased_points + ?,
                            updated_at = NOW()
                        WHERE email = ?`;
    let rechargeParams = [amount, userIdStr];
    
    // 如果userId是数字，添加id匹配条件
    if (!isNaN(userIdStr) && userIdStr.trim() !== '') {
      rechargeQuery = `UPDATE kbit_users 
                       SET purchased_points = purchased_points + ?,
                           updated_at = NOW()
                       WHERE email = ? OR id = ?`;
      rechargeParams = [amount, userIdStr, parseInt(userIdStr)];
    }
    
    await db.query(rechargeQuery, rechargeParams);
    
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
    // 处理用户ID：如果是数字，按id匹配；否则按email匹配
    
    // 确保 userId 是字符串类型
    const userIdStr = String(userId);
    
    let userQuery = 'SELECT nickname, email, purchased_points, total_consumed_points FROM kbit_users WHERE email = ?';
    let userParams = [userIdStr];
    
    // 如果userId是数字，添加id匹配条件
    if (!isNaN(userIdStr) && userIdStr.trim() !== '') {
      userQuery = 'SELECT nickname, email, purchased_points, total_consumed_points FROM kbit_users WHERE email = ? OR id = ?';
      userParams = [userIdStr, parseInt(userIdStr)];
    }
    
    let userRows = [];
    try {
      [userRows] = await db.query(userQuery, userParams);
    } catch (dbErr) {
      console.error('[PH8 Token] 查询用户信息失败:', dbErr);
    }
    
    const userNickname = userRows.length > 0 ? userRows[0].nickname : null;
    const userEmail = userRows.length > 0 ? userRows[0].email : userId;
    const purchasedPoints = userRows.length > 0 ? userRows[0].purchased_points : 0;
    const totalConsumedPoints = userRows.length > 0 ? userRows[0].total_consumed_points : 0;
    
    // 2. 实时统计今日使用（从 kbit_usage_logs 表）
    let todayStats = { totalTokens: 0, requestCount: 0 };
    try {
      [todayStats] = await db.query(
        `SELECT
          COALESCE(SUM(points_cost), 0) as totalTokens,
          COUNT(*) as requestCount
         FROM kbit_usage_logs
         WHERE user_id = ?
         AND DATE(created_at) = CURDATE()`,
        [userId]
      );
    } catch (dbErr) {
      console.error('[PH8 Token] 查询今日统计失败:', dbErr);
    }

    // 3. 实时统计本月使用（从 kbit_usage_logs 表）
    let monthStats = { totalTokens: 0, requestCount: 0 };
    try {
      [monthStats] = await db.query(
        `SELECT
          COALESCE(SUM(points_cost), 0) as totalTokens,
          COUNT(*) as requestCount
         FROM kbit_usage_logs
         WHERE user_id = ?
         AND YEAR(created_at) = YEAR(CURDATE())
         AND MONTH(created_at) = MONTH(CURDATE())`,
        [userId]
      );
    } catch (dbErr) {
      console.error('[PH8 Token] 查询本月统计失败:', dbErr);
    }

    // 4. 实时统计累计使用（从 kbit_usage_logs 表）
    let totalStats = { totalTokens: 0, requestCount: 0 };
    try {
      [totalStats] = await db.query(
        `SELECT
          COALESCE(SUM(points_cost), 0) as totalTokens,
          COUNT(*) as requestCount
         FROM kbit_usage_logs
         WHERE user_id = ?`,
        [userId]
      );
    } catch (dbErr) {
      console.error('[PH8 Token] 查询累计统计失败:', dbErr);
    }
    
    // PH8 返回的 total_tokens 是费用，单位：元
    // 但数据库中存储的值可能是以"分"为单位的（如 14 表示 0.0144 元）
    // 计算逻辑：积分 = 费用（元） × 1000 = (存储值 / 1000) × 1000 = 存储值
    // 例如：存储值 = 14 → 积分 = 14
    
    // 将费用转换为积分
    const usedTodayPoints = Math.ceil((todayStats.totalTokens || 0));
    const usedThisMonthPoints = Math.ceil((monthStats.totalTokens || 0));
    const totalUsedPoints = Math.ceil((totalStats.totalTokens || 0));
    
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
    // 数据库连接失败时返回默认余额信息
    return {
      userId,
      userNickname: null,
      userEmail: userId,
      totalBalance: 0,
      usedToday: 0,
      usedThisMonth: 0,
      totalUsed: 0,
      usedTodayTokens: 0,
      usedThisMonthTokens: 0,
      totalUsedTokens: 0,
      todayRequestCount: 0,
      monthRequestCount: 0,
      totalRequestCount: 0
    };
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
        0 as avgResponseTime
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
 * 检查并处理用户等级到期自动降级
 * 将 tier_expires_at < NOW() 的非 free 用户降级为 free
 * @returns {Promise<Object>} { downgraded: number, skipped: number }
 */
async function checkTierExpiry() {
  try {
    // 1. 查找所有已到期且仍是非 free 等级的用户
    const [expiredUsers] = await db.query(
      `SELECT id, email, nickname, user_tier, tier_expires_at 
       FROM kbit_users 
       WHERE tier_expires_at IS NOT NULL 
         AND tier_expires_at < NOW() 
         AND user_tier != 'free'
         AND status = 1`
    );

    if (expiredUsers.length === 0) {
      console.log('[等级到期] 无到期用户需要降级');
      return { downgraded: 0, skipped: 0 };
    }

    let downgradedCount = 0;
    for (const user of expiredUsers) {
      // 执行降级：tier → free, 清空到期时间, daily_points 重置为免费额度
      await db.query(
        `UPDATE kbit_users 
         SET user_tier = 'free', 
             tier_expires_at = NULL,
             daily_points = 200,
             updated_at = NOW()
         WHERE id = ?`,
        [user.id]
      );
      console.log(`[等级到期] 用户 ${user.email} (${user.user_tier}→free) 已降级，原到期时间: ${user.tier_expires_at}`);
      downgradedCount++;
    }

    console.log(`[等级到期] 本次共降级 ${downgradedCount}/${expiredUsers.length} 个用户`);
    return { downgraded: downgradedCount, skipped: expiredUsers.length - downgradedCount };
  } catch (err) {
    console.error('[等级到期] 检查失败:', err);
    return { downgraded: 0, skipped: 0 };
  }
}

/**
 * 实时检查单个用户的等级是否过期（供 API 调用时使用）
 * 如果过期则立即降级并返回新等级
 * @param {number|string} userId - 用户ID
 * @returns {Promise<{ expired: boolean, previousTier: string, currentTier: string } | null>}
 */
async function checkUserTierExpiry(userId) {
  try {
    const [users] = await db.query(
      `SELECT id, user_tier, tier_expires_at FROM kbit_users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) return null;

    const user = users[0];

    // free 等级或无到期时间的用户不需要检查
    if (user.user_tier === 'free' || !user.tier_expires_at) {
      return { expired: false, previousTier: user.user_tier, currentTier: user.user_tier };
    }

    // 检查是否过期
    const expiryDate = new Date(user.tier_expires_at);
    if (expiryDate <= new Date()) {
      // 过期 → 立即降级
      await db.query(
        `UPDATE kbit_users 
         SET user_tier = 'free', 
             tier_expires_at = NULL,
             daily_points = 200,
             updated_at = NOW()
         WHERE id = ?`,
        [userId]
      );
      console.log(`[等级到期-实时] 用户ID ${userId} (${user.user_tier}→free) 已即时降级`);
      return { expired: true, previousTier: user.user_tier, currentTier: 'free' };
    }

    return { expired: false, previousTier: user.user_tier, currentTier: user.user_tier };
  } catch (err) {
    console.error('[等级到期-实时] 检查失败:', err);
    return null;
  }
}

/**
 * 重置每日使用计数
 * @returns {Promise<boolean>}
 */
async function resetDailyUsage() {
  try {
    // 先执行等级到期降级检查
    await checkTierExpiry();

    // 再重置每日积分
    await db.query(
      `UPDATE kbit_users SET daily_points = CASE WHEN user_tier = 'free' THEN 200 WHEN user_tier = 'beta' THEN 200 WHEN user_tier = 'basic' THEN 400 WHEN user_tier = 'pro' THEN 1500 WHEN user_tier = 'plus' THEN 2000 ELSE 200 END, updated_at = NOW()`
    );
    console.log('[PH8 Token] 每日使用计数已重置（含等级到期检查）');
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
    console.log('[PH8 Token] 每月重置完成（无需操作）');
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
  checkTierExpiry,       // 新增：批量检查到期降级
  checkUserTierExpiry,    // 新增：单用户实时到期检查
  resetDailyUsage,
  resetMonthlyUsage,
  logApiCall
};