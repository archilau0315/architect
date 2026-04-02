require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const inviteRoutes = require('./routes/invite');
const watermarkRoutes = require('./routes/watermark');
const usageRoutes = require('./routes/usage');
const betaRoutes = require('./routes/beta');
const ph8Routes = require('./routes/ph8');
const planRoutes = require('./routes/plan');
const ph8BalanceRoutes = require('./routes/ph8Balance');
const gatewayRoutes = require('./routes/gateway');
const ph8TokenService = require('./services/ph8TokenService');

const app = express();
app.use(cors({
  origin: ['https://www.kbitai.com.cn', 'https://kbitai.com.cn', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/invite', inviteRoutes);
app.use('/api/watermark', watermarkRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/beta', betaRoutes);
app.use('/api/plan', planRoutes);
// PH8 余额路由必须在 ph8Routes 之前加载，避免被通配符路由捕获
app.use('/api/ph8', ph8BalanceRoutes);
app.use('/api/ph8', ph8Routes);

// 通用网关路由（支持多网关）
// 新格式: /api/gateway/:gatewayKey/*
// 示例: /api/gateway/ph8/chat/completions
app.use('/api/gateway', gatewayRoutes);

// 兼容旧路由：/api/ph8/* 仍然可用
// 后续可以逐步迁移到 /api/gateway/ph8/*

// ==================== 用户认证 API ====================

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' });
  }
  
  try {
    const [users] = await db.query(
      'SELECT * FROM `kbit-users` WHERE email = ? AND status = ?',
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

// 请求密码重置
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: '请输入邮箱地址' });
  }
  
  try {
    // 检查用户是否存在
    const [users] = await db.query(
      'SELECT * FROM `kbit-users` WHERE email = ? AND status = ?',
      [email, 'active']
    );
    
    if (users.length === 0) {
      // 为了安全，即使用户不存在也返回成功
      return res.json({ success: true, message: '如果该邮箱已注册，我们将发送密码重置链接' });
    }
    
    // 生成重置令牌
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1小时后过期
    
    // 保存令牌到数据库
    await db.query(
      'INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (?, ?, ?)',
      [email, token, expiresAt]
    );
    
    // 这里应该发送邮件，但为了简化，我们直接返回令牌（生产环境应该发送邮件）
    console.log(`[密码重置] 用户 ${email} 的重置令牌: ${token}`);
    
    res.json({ 
      success: true, 
      message: '如果该邮箱已注册，我们将发送密码重置链接',
      // 开发环境返回令牌，生产环境应该删除这行
      token: token 
    });
  } catch (err) {
    console.error('[密码重置] 请求失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 验证重置令牌
app.get('/api/auth/verify-reset-token', async (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: '缺少令牌' });
  }
  
  try {
    const [tokens] = await db.query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW() AND used_at IS NULL',
      [token]
    );
    
    if (tokens.length === 0) {
      return res.status(400).json({ error: '令牌无效或已过期' });
    }
    
    res.json({ success: true, email: tokens[0].email });
  } catch (err) {
    console.error('[密码重置] 验证令牌失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 重置密码
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }
  
  try {
    // 验证令牌
    const [tokens] = await db.query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW() AND used_at IS NULL',
      [token]
    );
    
    if (tokens.length === 0) {
      return res.status(400).json({ error: '令牌无效或已过期' });
    }
    
    const email = tokens[0].email;
    
    // 加密新密码
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // 更新用户密码
    await db.query(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [passwordHash, email]
    );
    
    // 标记令牌为已使用
    await db.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ?',
      [token]
    );
    
    console.log(`[密码重置] 用户 ${email} 的密码已重置`);
    
    res.json({ success: true, message: '密码重置成功' });
  } catch (err) {
    console.error('[密码重置] 重置密码失败:', err);
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
      'SELECT * FROM `kbit-users` WHERE user_id = ?',
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
      'SELECT * FROM `kbit-users` WHERE user_id = ?',
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
      'INSERT INTO point_logs (user_id, user_nickname, user_email, amount, type, description) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, user.nickname || '未知用户', user.email || userId, -amount, 'consume', description || '']
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

// 管理员登录
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }
  
  try {
    const [admins] = await db.query(
      'SELECT * FROM admins WHERE username = ?',
      [username]
    );
    
    if (admins.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const admin = admins[0];
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(password, admin.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    // 更新登录时间和IP
    await db.query(
      'UPDATE admins SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
      [req.ip || req.connection.remoteAddress, admin.id]
    );
    
    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, user_id, email, nickname, tier, total_points, daily_quota, daily_used, status, created_at FROM `kbit-users` ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 定时任务：每日重置 ====================
// 每天凌晨 0:00 重置每日使用计数
function scheduleDailyReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow - now;
  
  console.log(`[定时任务] 下次每日重置将在 ${Math.round(msUntilMidnight / 1000 / 60)} 分钟后执行`);
  
  setTimeout(async () => {
    console.log('[定时任务] 执行每日重置...');
    await ph8TokenService.resetDailyUsage();
    
    // 检查是否需要重置每月计数（每月1号）
    const today = new Date();
    if (today.getDate() === 1) {
      console.log('[定时任务] 执行每月重置...');
      await ph8TokenService.resetMonthlyUsage();
    }
    
    // 递归设置下一次重置
    scheduleDailyReset();
  }, msUntilMidnight);
}

// 启动定时任务
scheduleDailyReset();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
