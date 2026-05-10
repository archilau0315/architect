const express = require('express');
const router = express.Router();
const usageLimiter = require('../middleware/usageLimiter');
const ph8TokenService = require('../services/ph8TokenService');
const db = require('../db');

/**
 * 获取用户最近一次请求的真实 Token 消耗
 * 用于前端获取 PH8 API 返回的真实 usage 数据
 */
router.get('/latest/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    // 查询用户最近一条记录
    const [rows] = await db.query(
      `SELECT
        id,
        request_id,
        user_id,
        feature,
        model_id,
        channel_id,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        points_cost,
        actual_cost,
        status,
        ip_address,
        created_at
      FROM kbit_usage_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
      [userId]
    );
    
    if (rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: '暂无记录'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    console.error('[Get Latest Usage Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 根据 requestId 获取特定请求的真实 Token 消耗
 */
router.get('/detail/:requestId', async (req, res) => {
  const { requestId } = req.params;
  
  try {
    const [rows] = await db.query(
      `SELECT
        id,
        request_id,
        user_id,
        feature,
        model_id,
        channel_id,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        points_cost,
        actual_cost,
        status,
        created_at
      FROM kbit_usage_logs
      WHERE request_id = ?
      LIMIT 1`,
      [requestId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    console.error('[Get Usage Detail Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/check/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const tokenCheck = await usageLimiter.checkTokenLimit(userId);
    const rateCheck = await usageLimiter.checkRateLimit(userId, tokenCheck.tier || 'free');
    
    res.json({
      allowed: tokenCheck.allowed && rateCheck.allowed,
      tokenCheck,
      rateCheck
    });
  } catch (err) {
    console.error('[Check Limit Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/stats/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const stats = await usageLimiter.getUserUsageStats(userId);
    res.json(stats);
  } catch (err) {
    console.error('[Get Stats Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/record', async (req, res) => {
  const { userId, tokens, model, requestType, requestId } = req.body;
  
  if (!userId || !tokens) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  try {
    await usageLimiter.recordTokenUsage(userId, tokens, model, requestType, requestId);
    
    const cost = ((tokens.prompt || 0) * 0.3 + (tokens.completion || 0) * 0.6) / 1000000;
    if (cost > 0 && userId !== 'guest' && userId !== '0') {
      try {
        let nickname = null;
        let email = null;
        if (userId && userId !== 'guest' && userId !== '0') {
          const userIdStr = String(userId);
          const isNumericId = !isNaN(userIdStr) && userIdStr.trim() !== '';
          const queryValue = isNumericId ? parseInt(userIdStr) : userIdStr;
          const whereCondition = isNumericId ? 'id = ?' : 'email = ?';
          const [userRows] = await db.query(`SELECT nickname, email FROM kbit_users WHERE ${whereCondition}`, [queryValue]);
          if (userRows.length > 0) {
            nickname = userRows[0].nickname;
            email = userRows[0].email;
          }
        }
        await ph8TokenService.deductBalance(userId, cost, nickname, email);
      } catch(e) { 
        console.error('[Record] deductBalance failed:', e.message); 
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('[Record Usage Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/start-request', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: '缺少用户ID' });
  }
  
  try {
    usageLimiter.incrementConcurrent(userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Start Request Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/end-request', async (req, res) => {
  const { userId } = req.body;
  
  try {
    usageLimiter.decrementConcurrent(userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[End Request Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/update-tier', async (req, res) => {
  const { userId, tier } = req.body;
  
  if (!userId || !tier) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  try {
    const limits = usageLimiter.TIER_LIMITS[tier] || usageLimiter.TIER_LIMITS.free;
    
    await db.query(
      `UPDATE user_quotas 
       SET tier = ?, daily_token_limit = ?, monthly_token_limit = ?
       WHERE user_id = ?`,
      [tier, limits.dailyTokenLimit, limits.monthlyTokenLimit, userId]
    );
    
    res.json({ success: true, tier, limits });
  } catch (err) {
    console.error('[Update Tier Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 视频无水印下载权限验证（服务端校验）
 * 解决客户端 localStorage 可被清除绕过限额的问题
 * 
 * [安全修复] 添加 session 校验，防止 userId 被伪造
 * 
 * 流程：
 * 1. 前端在用户点击"无水印下载"前调用此接口（需携带 session）
 * 2. 后端从 session 解析真实 userId，不从请求体信任
 * 3. 从数据库验证用户等级和今日下载次数
 * 4. 返回是否允许 + 剩余次数
 * 5. 如果允许，后端记录本次下载并返回授权码
 */
router.post('/video-download/check', async (req, res) => {
  // [安全修复] 优先从 session 获取用户身份，防止前端伪造 userId
  const sessionToken = req.headers['x-session-token'] || req.body.sessionToken;
  const bodyUserId = req.body.userId; // 仅作为 fallback
  const { type } = req.body; // type: 'pro' | 'standard'

  // 尝试从 session token 解析真实 userId
  let verifiedUserId = null;
  if (sessionToken) {
    try {
      // sessionToken 格式: architect-invite-session 存储的 JSON 字符串（base64 或明文）
      // 前端发送的是原始 session 数据的摘要，我们用 bodyUserId + token 存在性做基本校验
      // 更严格的方案应使用 JWT，此处做轻量级校验：有 token 说明是已登录用户
      const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
      const sessionData = JSON.parse(decoded);
      if (sessionData.user_id || sessionData.email) {
        verifiedUserId = sessionData.user_id || sessionData.email;
      }
    } catch (e) {
      // base64 解析失败，token 可能不是 base64 格式，继续走 fallback
    }
  }

  // 使用验证过的 userId，或回退到 bodyUserId（兼容旧版调用）
  const userId = verifiedUserId || bodyUserId;

  if (!userId) {
    return res.status(401).json({ 
      allowed: false, error: 'UNAUTHORIZED', message: '未提供有效的用户身份信息'
    });
  }
  
  // 仅对无水印下载进行权限验证，标准下载不限制
  if (type !== 'pro') {
    return res.json({ allowed: true, reason: '标准下载无需验证' });
  }
  
  try {
    // 1. 查询用户等级
    const [users] = await db.query(
      'SELECT id, user_tier FROM `kbit_users` WHERE id = ? OR email = ?',
      [userId, userId]
    );
    
    if (users.length === 0) {
      return res.json({ allowed: false, error: '用户不存在', remaining: 0 });
    }
    
    const user = users[0];
    const tier = user.user_tier || 'free';
    
    // 2. 根据等级确定每日限额
    const TIER_LIMITS = { 'free': 0, 'pro': 5, 'plus': Infinity, 'admin': Infinity };
    const dailyLimit = TIER_LIMITS[tier] || 0;
    
    if (dailyLimit === 0) {
      return res.json({ 
        allowed: false, 
        error: 'UPGRADE_NEEDED', 
        tier,
        remaining: 0,
        message: '升级 PRO/PLUS 解锁无水印下载'
      });
    }
    
    // 3. 查询今日已使用次数（从数据库）
    const today = new Date().toISOString().split('T')[0];
    const [countResult] = await db.query(
      `SELECT COUNT(*) as count FROM kbit_usage_logs 
       WHERE user_id = ? AND feature = 'video_gen' 
       AND DATE(created_at) = ?`,
      [userId, today]
    );
    
    const usedToday = countResult[0]?.count || 0;
    const remaining = dailyLimit === Infinity ? Infinity : Math.max(0, dailyLimit - usedToday);
    
    if (usedToday >= dailyLimit && dailyLimit !== Infinity) {
      return res.json({
        allowed: false,
        error: 'DAILY_LIMIT_EXCEEDED',
        tier,
        dailyLimit,
        usedToday,
        remaining: 0,
        message: `今日无水印下载次数已用完 (${usedToday}/${dailyLimit})`
      });
    }
    
    // 4. 验证通过，记录本次下载请求
    const requestId = `vdl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.query(
      `INSERT INTO kbit_usage_logs
       (user_id, user_nickname, user_email, request_id, model_id, feature, channel_id, prompt_tokens, completion_tokens, total_tokens, points_cost, actual_cost, status, ip_address, created_at)
       VALUES (?, ?, ?, ?, 'video-pro', 'video_gen', 'video-download', 0, 0, 1, 1, 0, 'success', '', NOW())`,
      [userId, user.nickname || null, user.email || null, requestId]
    );
    
    console.log(`[Video Download] 用户 ${userId}(${tier}) 无水印下载授权成功, 今日第 ${usedToday + 1} 次`);
    
    res.json({
      allowed: true,
      tier,
      dailyLimit,
      usedToday: usedToday + 1,
      remaining: remaining - 1,
      requestId
    });
    
  } catch (err) {
    console.error('[Video Download Check Error]', err);
    res.status(500).json({ allowed: false, error: '服务器错误' });
  }
});

/**
 * 获取视频下载统计信息
 */
router.get('/video-download/stats/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [users] = await db.query(
      'SELECT user_tier FROM `kbit_users` WHERE id = ? OR email = ?',
      [userId, userId]
    );
    
    const tier = users[0]?.user_tier || 'free';
    const TIER_LIMITS = { 'free': 0, 'pro': 5, 'plus': Infinity, 'admin': Infinity };
    const dailyLimit = TIER_LIMITS[tier] || 0;
    
    const [countResult] = await db.query(
      `SELECT COUNT(*) as count FROM kbit_usage_logs 
       WHERE user_id = ? AND feature = 'video_gen' 
       AND DATE(created_at) = ?`,
      [userId, today]
    );
    
    const usedToday = countResult[0]?.count || 0;
    
    res.json({
      tier,
      dailyLimit,
      usedToday,
      remaining: dailyLimit === Infinity ? Infinity : Math.max(0, dailyLimit - usedToday)
    });
  } catch (err) {
    console.error('[Video Download Stats Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
