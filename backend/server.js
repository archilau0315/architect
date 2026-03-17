require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const inviteRoutes = require('./routes/invite');
const watermarkRoutes = require('./routes/watermark');
const usageRoutes = require('./routes/usage');

const app = express();
app.use(cors({
  origin: ['https://www.kbitai.com.cn', 'https://kbitai.com.cn', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

app.use('/api/invite', inviteRoutes);
app.use('/api/watermark', watermarkRoutes);
app.use('/api/usage', usageRoutes);

// ==================== 用户认证 API ====================

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' });
  }
  
  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? AND status = ?',
      [email, 'active']
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    const user = users[0];
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    res.json({
      success: true,
      user: {
        userId: user.user_id,
        email: user.email,
        nickname: user.nickname,
        tier: user.tier,
        totalPoints: user.total_points
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取用户信息
app.get('/api/user/info', async (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  
  if (!userId) {
    return res.json({ tier: 'free', totalPoints: 0 });
  }
  
  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE user_id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.json({ tier: 'free', totalPoints: 0 });
    }
    
    const user = users[0];
    const today = new Date().toISOString().split('T')[0];
    
    if (user.last_reset_date !== today) {
      await db.query(
        'UPDATE users SET daily_used = 0, last_reset_date = ? WHERE user_id = ?',
        [today, userId]
      );
      user.daily_used = 0;
    }
    
    res.json({
      userId: user.user_id,
      email: user.email,
      nickname: user.nickname,
      tier: user.tier,
      totalPoints: user.total_points,
      dailyQuota: user.daily_quota,
      dailyUsed: user.daily_used,
      dailyRemaining: Math.max(0, user.daily_quota - user.daily_used)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 消耗积分
app.post('/api/user/consume', async (req, res) => {
  const { amount, description } = req.body;
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }
  
  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE user_id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(403).json({ error: '用户不存在' });
    }
    
    const user = users[0];
    const today = new Date().toISOString().split('T')[0];
    
    let dailyUsed = user.daily_used;
    if (user.last_reset_date !== today) {
      await db.query(
        'UPDATE users SET daily_used = 0, last_reset_date = ? WHERE user_id = ?',
        [today, userId]
      );
      dailyUsed = 0;
    }
    
    const dailyRemaining = user.daily_quota - dailyUsed;
    if (dailyRemaining < amount) {
      return res.status(400).json({ error: '今日积分额度不足' });
    }
    
    if (user.total_points < amount) {
      return res.status(400).json({ error: '积分余额不足' });
    }
    
    await db.query(
      'UPDATE users SET daily_used = daily_used + ?, total_points = total_points - ? WHERE user_id = ?',
      [amount, amount, userId]
    );
    
    await db.query(
      'INSERT INTO point_logs (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
      [userId, -amount, 'consume', description || '']
    );
    
    res.json({ success: true, consumed: amount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 内容注册 API ====================

app.post('/api/content/register', async (req, res) => {
  const { contentId, contentType, userId, metadata } = req.body;
  
  try {
    await db.query(
      'INSERT INTO content_registry (content_id, content_type, user_id, metadata) VALUES (?, ?, ?, ?)',
      [contentId, contentType, userId, JSON.stringify(metadata || {})]
    );
    
    res.json({ success: true, contentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/content/verify/:contentId', async (req, res) => {
  const { contentId } = req.params;
  
  try {
    const [rows] = await db.query(
      'SELECT * FROM content_registry WHERE content_id = ?',
      [contentId]
    );
    
    if (rows.length === 0) {
      return res.json({ found: false });
    }
    
    res.json({ found: true, content: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 下载日志 API ====================

app.post('/api/logs/download', async (req, res) => {
  const { contentId, contentType, userId, downloadType, metadata } = req.body;
  
  try {
    await db.query(
      'INSERT INTO download_logs (content_id, content_type, user_id, download_type, metadata, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [contentId, contentType, userId, downloadType || 'standard', JSON.stringify(metadata || {}), req.ip || req.connection.remoteAddress, req.headers['user-agent'] || '']
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 管理后台 API ====================

app.get('/api/admin/users', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, user_id, email, nickname, tier, total_points, daily_quota, daily_used, status, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
