const express = require('express');
const router = express.Router();
const ph8TokenService = require('../services/ph8TokenService');

/**
 * 获取当前用户信息（含等级过期状态）
 * GET /api/ph8/user-info
 */
router.get('/user-info', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId;
    if (!userId || userId === 'guest') {
      return res.json({ success: true, data: { tier: 'free', tierExpired: false } });
    }

    // 查询用户信息（包含 tier_expires_at）
    const db = require('../db');
    const [users] = await db.query(
      `SELECT id, email, nickname, user_tier, daily_points, purchased_points, 
              total_consumed_points, tier_expires_at, last_reset_date
       FROM kbit_users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.json({ success: true, data: { tier: 'free', tierExpired: false } });
    }

    const user = users[0];
    let effectiveTier = user.user_tier;
    let tierExpired = false;

    // 实时检查等级是否过期
    if (effectiveTier !== 'free' && user.tier_expires_at) {
      const expiryDate = new Date(user.tier_expires_at);
      if (expiryDate <= new Date()) {
        // 过期 → 立即降级为 free
        await db.query(
          `UPDATE kbit_users SET user_tier = 'free', tier_expires_at = NULL, daily_points = 200, updated_at = NOW() WHERE id = ?`,
          [userId]
        );
        tierExpired = true;
        effectiveTier = 'free';
        console.log(`[user-info] 用户 ${userId} 等级已过期(${user.user_tier}→free)，已降级`);
      }
    }

    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        nickname: user.nickname,
        tier: effectiveTier,
        tierExpired: tierExpired,
        previousTier: tierExpired ? user.user_tier : null,
        tierExpiresAt: effectiveTier === 'free' ? null : user.tier_expires_at,
        points: {
          daily: user.daily_points,
          purchased: user.purchased_points,
          totalConsumed: user.total_consumed_points || 0
        }
      }
    });
  } catch (err) {
    console.error('[PH8 User-Info] 获取失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 获取当前用户余额
 * GET /api/ph8/balance
 * 返回数据同时包含积分和Token（从 ph8_token_usage 表实时统计）
 */
router.get('/balance', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || 'guest';
    
    const balance = await ph8TokenService.getUserBalance(userId);
    
    if (!balance) {
      return res.status(500).json({ error: '获取余额失败' });
    }
    
    // Token 到积分的换算比例
    const TOKENS_PER_POINT = 100;
    
    // 计算剩余余额（积分）
    const remainingPoints = Math.max(0, balance.totalBalance - balance.usedToday);
    const remainingTokens = remainingPoints * TOKENS_PER_POINT;
    
    const result = {
      // 用户基本信息
      userId: balance.userId,
      userNickname: balance.userNickname,
      userEmail: balance.userEmail,
      
      // 积分单位
      points: {
        totalBalance: balance.totalBalance,        // 总充值积分
        usedToday: balance.usedToday,              // 今日已用（积分）
        usedThisMonth: balance.usedThisMonth,      // 本月已用（积分）
        totalUsed: balance.totalUsed,              // 累计使用（积分）
        remaining: remainingPoints                 // 剩余可用（积分）
      },
      
      // Token单位
      tokens: {
        usedToday: balance.usedTodayTokens,        // 今日已用（token）
        usedThisMonth: balance.usedThisMonthTokens,// 本月已用（token）
        totalUsed: balance.totalUsedTokens,        // 累计使用（token）
        remaining: remainingTokens,                // 剩余可用（token）
        conversionRate: TOKENS_PER_POINT           // 换算比例
      },
      
      // 请求次数统计
      requestCount: {
        today: balance.todayRequestCount,
        thisMonth: balance.monthRequestCount,
        total: balance.totalRequestCount
      },
      
      // 时间信息
      lastRequestAt: balance.lastRequestAt,
      lastResetDaily: balance.lastResetDaily,
      lastResetMonthly: balance.lastResetMonthly
    };
    
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[PH8 Balance] 获取余额失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 获取用户使用记录
 * GET /api/ph8/usage
 * Query: limit, offset
 */
router.get('/usage', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || 'guest';
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const history = await ph8TokenService.getUserUsageHistory(userId, limit, offset);
    
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    console.error('[PH8 Balance] 获取使用记录失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 获取用户使用统计
 * GET /api/ph8/stats
 * Query: startDate, endDate
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || 'guest';
    const startDate = req.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 默认30天前
    const endDate = req.query.endDate || new Date();
    
    const stats = await ph8TokenService.getUserUsageStats(userId, startDate, endDate);
    
    if (!stats) {
      return res.status(500).json({ error: '获取统计失败' });
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('[PH8 Balance] 获取统计失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 获取今日使用统计
 * GET /api/ph8/today
 */
router.get('/today', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || 'guest';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const stats = await ph8TokenService.getUserUsageStats(userId, today, tomorrow);
    
    if (!stats) {
      return res.status(500).json({ error: '获取今日统计失败' });
    }
    
    res.json({
      success: true,
      data: {
        requestCount: stats.requestCount || 0,
        totalTokens: stats.totalTokens || 0,
        promptTokens: stats.promptTokens || 0,
        completionTokens: stats.completionTokens || 0
      }
    });
  } catch (err) {
    console.error('[PH8 Balance] 获取今日统计失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 充值（管理员接口）
 * POST /api/ph8/recharge
 * Body: userId, amount
 */
router.post('/recharge', async (req, res) => {
  try {
    // 简单的管理员验证（实际应该使用更严格的验证）
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { userId, amount } = req.body;
    
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: '参数错误' });
    }
    
    const result = await ph8TokenService.rechargeBalance(userId, amount);
    
    if (result) {
      res.json({
        success: true,
        message: `成功为用户 ${userId} 充值 ${amount} tokens`
      });
    } else {
      res.status(500).json({ error: '充值失败' });
    }
  } catch (err) {
    console.error('[PH8 Balance] 充值失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 获取指定用户使用记录（管理员）
 * GET /api/ph8/usage/:userId
 */
router.get('/usage/:userId', async (req, res) => {
  try {
    // 简单的管理员验证
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const history = await ph8TokenService.getUserUsageHistory(userId, limit, offset);
    const balance = await ph8TokenService.getUserBalance(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        balance,
        history
      }
    });
  } catch (err) {
    console.error('[PH8 Balance] 获取用户使用记录失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 获取所有用户统计（管理员）
 * GET /api/ph8/admin/stats
 */
router.get('/admin/stats', async (req, res) => {
  try {
    // 简单的管理员验证
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 这里可以添加获取所有用户统计的逻辑
    // 暂时返回空数据
    res.json({
      success: true,
      data: {
        message: '管理员统计接口'
      }
    });
  } catch (err) {
    console.error('[PH8 Balance] 获取管理员统计失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;