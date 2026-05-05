const db = require('../db');
const tierConfig = require('../config/tierConfig');

// [标准化] 用户等级每日积分配置 - 从中心配置导入
const tierDailyQuota = tierConfig.tierDailyQuota;

// 获取用户信息
exports.getUserInfo = async (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId;

  if (!userId) {
    return res.json({ tier: 'free', totalPoints: 0 });
  }

  try {
    const [users] = await db.query(
      'SELECT id, email, nickname, user_tier, total_earned, total_points, daily_quota, daily_used, daily_reset_at, tier_expires_at FROM kbit_users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.json({ tier: 'free', totalPoints: 0 });
    }

    const user = users[0];
    let effectiveTier = user.user_tier;
    let tierExpired = false;

    const today = new Date().toISOString().split('T')[0];
    const dailyQuota = tierDailyQuota[effectiveTier] || tierDailyQuota['free'];

    if (user.daily_reset_at !== today) {
      await db.query('UPDATE kbit_users SET daily_used = 0, daily_reset_at = ? WHERE id = ?', [today, userId]);
      user.daily_used = 0;
    }

    const [todayUsage] = await db.query(
      `SELECT COALESCE(SUM(points_cost), 0) as today_spent FROM kbit_usage_logs WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [userId]
    );
    const realTodayUsed = Math.ceil(todayUsage[0]?.today_spent || 0);
    if (realTodayUsed > (user.daily_used || 0)) {
      user.daily_used = realTodayUsed;
      await db.query('UPDATE kbit_users SET daily_used = ? WHERE id = ?', [realTodayUsed, userId]);
    }

    if (effectiveTier !== 'free' && user.tier_expires_at) {
      if (new Date(user.tier_expires_at) <= new Date()) {
        await db.query(`UPDATE kbit_users SET user_tier='free', tier_expires_at=NULL, daily_quota=200, updated_at=NOW() WHERE id=?`, [userId]);
        tierExpired = true; effectiveTier = 'free';
      }
    }

    const dailyRemaining = Math.max(0, (user.daily_quota || dailyQuota) - (user.daily_used || 0));

    res.json({
      userId: user.id, email: user.email, nickname: user.nickname,
      tier: effectiveTier, tierExpired, previousTier: tierExpired ? user.user_tier : null,

      totalPoints: user.total_earned || 0,
      balance: (user.total_points || 0) + dailyRemaining,
      consumedTotal: (user.total_earned || 0) - (user.total_points || 0),

      dailyQuota: user.daily_quota || dailyQuota,
      dailyUsed: user.daily_used || 0,
      dailyRemaining: dailyRemaining
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 获取用户配额信息（供前端导航栏实时显示）
exports.getQuota = async (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId;

  if (!userId) {
    return res.json({ success: false, error: '未登录' });
  }

  try {
    const isEmail = userId.includes('@');
    const query = isEmail
      ? 'SELECT total_earned, total_points, daily_quota, daily_used, daily_reset_at, user_tier, tier_expires_at FROM kbit_users WHERE email = ?'
      : 'SELECT total_earned, total_points, daily_quota, daily_used, daily_reset_at, user_tier, tier_expires_at FROM kbit_users WHERE id = ?';
    
    const [users] = await db.query(query, [userId]);

    if (users.length === 0) {
      return res.json({ success: false, error: '用户不存在' });
    }

    const user = users[0];
    let effectiveTier = user.user_tier;
    let tierExpired = false;

    if (effectiveTier !== 'free' && user.tier_expires_at) {
      if (new Date(user.tier_expires_at) <= new Date()) {
        await db.query(`UPDATE kbit_users SET user_tier='free',tier_expires_at=NULL,daily_quota=200,updated_at=NOW() WHERE id=?`, [userId]);
        tierExpired = true; effectiveTier = 'free';
        user.daily_quota = 200;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    let actualDailyUsed = user.daily_used || 0;
    let actualDailyQuota = user.daily_quota || 200;

    if (user.daily_reset_at !== today || !user.daily_reset_at) {
      actualDailyUsed = 0;
      await db.query('UPDATE kbit_users SET daily_used=0,daily_reset_at=? WHERE id=?', [today, userId]);
    }

    const [todayUsage] = await db.query(
      `SELECT COALESCE(SUM(points_cost), 0) as today_spent FROM kbit_usage_logs WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [userId]
    );
    const realTodayUsed = Math.ceil(todayUsage[0]?.today_spent || 0);
    if (realTodayUsed > actualDailyUsed) {
      actualDailyUsed = realTodayUsed;
      await db.query('UPDATE kbit_users SET daily_used = ? WHERE id = ?', [actualDailyUsed, userId]);
    }

    const totalEarned = user.total_earned || 0;
    const balance = user.total_points || 0;
    const dailyRemaining = Math.max(0, actualDailyQuota - actualDailyUsed);

    res.json({
      success: true,
      data: {
        points: {

          total_points: totalEarned,
          total_balance: balance + dailyRemaining,

          daily_quota: actualDailyQuota,
          daily_remaining: dailyRemaining,
          daily_used: actualDailyUsed
        },
        tier: effectiveTier,
        tierExpired: tierExpired,
        previousTier: tierExpired ? user.user_tier : null
      }
    });
  } catch (err) {
    console.error('[getQuota Error]', err);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
};

// 更新用户昵称
exports.updateNickname = async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { nickname } = req.body;

  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  if (!nickname || nickname.length < 2 || nickname.length > 20) {
    return res.status(400).json({ error: '昵称长度必须在2-20个字符之间' });
  }

  try {
    const [result] = await db.query(
      'UPDATE kbit_users SET nickname = ?, updated_at = NOW() WHERE id = ?',
      [nickname, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ success: true, nickname: nickname });
  } catch (err) {
    console.error('[updateNickname Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 消耗积分
exports.consumePoints = async (req, res) => {
  const { amount, description, feature, model_id } = req.body;
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const [users] = await db.query(
      'SELECT nickname, email, total_points, daily_quota, daily_used, daily_reset_at, user_tier, status FROM kbit_users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(403).json({ error: '用户不存在' });
    }

    const user = users[0];

    if (user.status !== 1) {
      return res.status(403).json({ error: '用户账号已被禁用' });
    }

    const today = new Date().toISOString().split('T')[0];
    let actualDailyUsed = user.daily_used || 0;
    let actualDailyQuota = user.daily_quota || 200;

    if (user.daily_reset_at !== today || !user.daily_reset_at) {
      actualDailyUsed = 0;
      await db.query(
        'UPDATE kbit_users SET daily_used = 0, daily_reset_at = ? WHERE id = ?',
        [today, userId]
      );
    }

    const dailyRemaining = Math.max(0, actualDailyQuota - actualDailyUsed);
    const totalAvailable = (user.total_points || 0) + dailyRemaining;

    if (totalAvailable < amount) {
      return res.status(400).json({ error: '积分余额不足' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let deductFromDaily = Math.min(amount, dailyRemaining);
      let deductFromTotal = amount - deductFromDaily;

      const newDailyUsed = actualDailyUsed + deductFromDaily;

      await connection.query(
        'UPDATE kbit_users SET total_points = GREATEST(0, total_points - ?), daily_used = ? WHERE id = ?',
        [deductFromTotal, newDailyUsed, userId]
      );

      await connection.query(
        'INSERT INTO point_logs (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
        [userId, -amount, 'consume', description || '']
      );

      const actualCost = amount / 1000;
      await connection.query(
        `INSERT INTO kbit_usage_logs (user_id, user_nickname, model_id, feature, actual_cost, points_cost, request_type, endpoint, status, created_at)
         VALUES (?, (SELECT nickname FROM kbit_users WHERE id = ?), ?, ?, ?, ?, 'frontend-consume', '/api/user/consume', 'success', NOW())
         ON DUPLICATE KEY UPDATE actual_cost = VALUES(actual_cost), points_cost = VALUES(points_cost), status = VALUES(status)`,
        [userId, userId, model_id || (feature || 'unknown'), feature || 'unknown', actualCost, amount]
      );

      await connection.commit();
      res.json({ success: true, consumed: amount, cost: actualCost });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
};
