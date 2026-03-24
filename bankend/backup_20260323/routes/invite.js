const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// 生成邀请码（管理员）
router.post('/generate', async (req, res) => {
  const { count = 1, pointsBonus = 1000, expiresInDays = 30, createdBy = 'admin' } = req.body;
  
  try {
    const codes = [];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    for (let i = 0; i < count; i++) {
      const code = generateInviteCode();
      await db.query(
        'INSERT INTO invite_codes (code, created_by, points_bonus, expires_at) VALUES (?, ?, ?, ?)',
        [code, createdBy, pointsBonus, expiresAt]
      );
      codes.push({ code, pointsBonus, expiresAt });
    }
    
    res.json({ success: true, codes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 验证邀请码
router.get('/verify/:code', async (req, res) => {
  const { code } = req.params;
  
  try {
    const [rows] = await db.query(
      'SELECT * FROM invite_codes WHERE code = ? AND status = ?',
      [code, 'active']
    );
    
    if (rows.length === 0) {
      return res.json({ valid: false, message: '邀请码无效或已使用' });
    }
    
    const inviteCode = rows[0];
    
    if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
      await db.query('UPDATE invite_codes SET status = ? WHERE code = ?', ['expired', code]);
      return res.json({ valid: false, message: '邀请码已过期' });
    }
    
    if (inviteCode.current_uses >= inviteCode.max_uses) {
      await db.query('UPDATE invite_codes SET status = ? WHERE code = ?', ['used', code]);
      return res.json({ valid: false, message: '邀请码已用完' });
    }
    
    res.json({ 
      valid: true, 
      pointsBonus: inviteCode.points_bonus,
      message: '邀请码有效'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 使用邀请码注册
router.post('/register', async (req, res) => {
  const { code, email, password, nickname } = req.body;
  
  if (!code || !email || !password) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  
  try {
    // 验证邀请码
    const [codeRows] = await db.query(
      'SELECT * FROM invite_codes WHERE code = ? AND status = ?',
      [code, 'active']
    );
    
    if (codeRows.length === 0) {
      return res.status(400).json({ error: '邀请码无效' });
    }
    
    const inviteCode = codeRows[0];
    
    // 检查邮箱是否已注册
    const [userRows] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (userRows.length > 0) {
      return res.status(400).json({ error: '该邮箱已注册' });
    }
    
    // 创建用户
    const userId = uuidv4();
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);
    
    await db.query(
      `INSERT INTO users (user_id, email, password_hash, nickname, tier, total_points, daily_quota)
       VALUES (?, ?, ?, ?, 'beta', ?, 200)`,
      [userId, email, passwordHash, nickname || email.split('@')[0], inviteCode.points_bonus]
    );
    
    // 更新邀请码使用状态
    await db.query(
      'UPDATE invite_codes SET current_uses = current_uses + 1, used_by = ?, used_at = NOW() WHERE code = ?',
      [userId, code]
    );
    
    if (inviteCode.current_uses + 1 >= inviteCode.max_uses) {
      await db.query('UPDATE invite_codes SET status = ? WHERE code = ?', ['used', code]);
    }
    
    // 记录积分日志
    await db.query(
      'INSERT INTO point_logs (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
      [userId, inviteCode.points_bonus, 'invite', '邀请码注册赠送']
    );
    
    res.json({ 
      success: true, 
      message: '注册成功',
      user: {
        userId,
        email,
        tier: 'beta',
        totalPoints: inviteCode.points_bonus
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取邀请码列表（管理员）
router.get('/list', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM invite_codes ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 生成随机邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'KB';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports = router;
