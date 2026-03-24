const express = require('express');
const router = express.Router();
const usageLimiter = require('../middleware/usageLimiter');

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
