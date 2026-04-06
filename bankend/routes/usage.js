const express = require('express');
const router = express.Router();
const usageLimiter = require('../middleware/usageLimiter');
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
        request_id,
        model_id as model,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        feature as request_type,
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
        request_id,
        user_id,
        model_id as model,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        feature as request_type,
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

module.exports = router;
