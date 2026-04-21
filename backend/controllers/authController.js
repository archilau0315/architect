const db = require('../db');
const mailService = require('../services/mailService');

// 用户登录
exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' });
  }
  
  try {
    const [users] = await db.query(
      'SELECT * FROM kbit_users WHERE email = ? AND status = ?',
      [email, 1]
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
        userId: user.id,
        email: user.email,
        nickname: user.nickname,
        tier: user.user_tier,
        totalPoints: user.daily_points + user.purchased_points
      }
    });
  } catch (err) {
    console.error(err);
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: '数据库连接失败，请检查后端服务状态' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
};

// 请求密码重置
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: '请输入邮箱地址' });
  }
  
  try {
    // 检查用户是否存在
    const [users] = await db.query(
      'SELECT * FROM kbit_users WHERE email = ? AND status = ?',
      [email, 1]
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
    
    // 发送密码重置邮件
    const emailSent = await mailService.sendPasswordResetEmail(email, token);
    
    console.log(`[密码重置] 用户 ${email} 的重置令牌: ${token}`);
    console.log(`[密码重置] 邮件发送状态: ${emailSent ? '成功' : '失败'}`);
    
    res.json({ 
      success: true, 
      message: '重置链接已发送到您的邮箱，请查收' 
    });
  } catch (err) {
    console.error('[密码重置] 请求失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 验证重置令牌
exports.verifyResetToken = async (req, res) => {
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
};

// 重置密码
exports.resetPassword = async (req, res) => {
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
      'UPDATE kbit_users SET password_hash = ? WHERE email = ?',
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
};
