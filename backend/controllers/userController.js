const db = require('../db');

// 获取用户信息
exports.getUserInfo = async (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  
  if (!userId) {
    return res.json({ tier: 'free', totalPoints: 0 });
  }
  
  try {
    const [users] = await db.query(
      'SELECT id, email, nickname, user_tier, daily_points, purchased_points, updated_at FROM kbit_users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.json({ tier: 'free', totalPoints: 0 });
    }
    
    const user = users[0];
    const today = new Date().toISOString().split('T')[0];
    
    if (user.updated_at !== today) {
      await db.query(
        'UPDATE kbit_users SET updated_at = ? WHERE id = ?',
        [today, userId]
      );
    }
    
    res.json({
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      tier: user.user_tier,
      totalPoints: user.daily_points + user.purchased_points,
      dailyQuota: 100,
      dailyUsed: 0,
      dailyRemaining: 100
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
    const [users] = await db.query(
      'SELECT daily_points, purchased_points, total_consumed_points, last_reset_date, user_tier FROM kbit_users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.json({ success: false, error: '用户不存在' });
    }
    
    const user = users[0];
    
    // 检查是否需要重置每日积分
    const today = new Date().toISOString().split('T')[0];
    if (user.last_reset_date !== today) {
      // 根据用户等级重置每日积分
      const tierDailyQuota = {
        'free': 200,
        'beta': 200,
        'basic': 400,
        'pro': 1500,
        'plus': 2000
      };
      const dailyQuota = tierDailyQuota[user.user_tier] || tierDailyQuota['free'];
      
      await db.query(
        'UPDATE kbit_users SET daily_points = ?, last_reset_date = ?, daily_used = 0 WHERE id = ?',
        [dailyQuota, today, userId]
      );
      
      return res.json({
        success: true,
        data: {
          points: {
            daily: dailyQuota,
            purchased: user.purchased_points,
            total_consumed: user.total_consumed_points || 0
          }
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        points: {
          daily: user.daily_points,
          purchased: user.purchased_points,
          total_consumed: user.total_consumed_points || 0
        }
      }
    });
  } catch (err) {
    console.error('[getQuota Error]', err);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
};

// 消耗积分
exports.consumePoints = async (req, res) => {
  const { amount, description } = req.body;
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }
  
  try {
    const [users] = await db.query(
      'SELECT nickname, email, daily_points, purchased_points, total_consumed_points, status FROM kbit_users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(403).json({ error: '用户不存在' });
    }
    
    const user = users[0];
    
    // 检查用户状态
    if (user.status !== 1) {
      return res.status(403).json({ error: '用户账号已被禁用' });
    }
    
    const totalPoints = user.daily_points + user.purchased_points;
    if (totalPoints < amount) {
      return res.status(400).json({ error: '积分余额不足' });
    }
    
    // 使用事务确保数据一致性
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // 优先使用 daily_points
      let dailyUsed = Math.min(user.daily_points, amount);
      let purchasedUsed = amount - dailyUsed;
      
      await connection.query(
        'UPDATE kbit_users SET daily_points = daily_points - ?, purchased_points = purchased_points - ?, total_consumed_points = total_consumed_points + ? WHERE id = ?',
        [dailyUsed, purchasedUsed, amount, userId]
      );

      await connection.query(
        'INSERT INTO point_logs (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
        [userId, -amount, 'consume', description || '']
      );
      
      await connection.commit();
      res.json({ success: true, consumed: amount });
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
