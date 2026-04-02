const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const ph8TokenService = require('../services/ph8TokenService');

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
      'SELECT * FROM `kbit-users` WHERE email = ?',
      [email]
    );

    if (userRows.length > 0) {
      return res.status(400).json({ error: '该邮箱已注册' });
    }

    // 创建用户
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);
    const user_id = 'user_' + Date.now() + Math.floor(Math.random() * 1000);

    await db.query(
      "INSERT INTO `kbit-users` (user_id, email, password_hash, nickname, tier, total_points, daily_quota, daily_used, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'beta', ?, 100, 0, 'active', NOW(), NOW())",
      [user_id, email, passwordHash, nickname || email.split('@')[0], inviteCode.points_bonus]
    );

    // 获取新创建的用户ID
    const [newUserRows] = await db.query(
      'SELECT user_id FROM `kbit-users` WHERE email = ?',
      [email]
    );
    const userId = newUserRows[0].user_id;
    
    // 更新邀请码使用状态
    await db.query(
      'UPDATE invite_codes SET current_uses = current_uses + 1, used_by = ?, used_at = NOW() WHERE code = ?',
      [userId, code]
    );
    
    if (inviteCode.current_uses + 1 >= inviteCode.max_uses) {
      await db.query('UPDATE invite_codes SET status = ? WHERE code = ?', ['used', code]);
    }
    
    // 记录积分日志
    const userNickname = nickname || email.split('@')[0];
    await db.query(
      'INSERT INTO point_logs (user_id, user_nickname, user_email, amount, type, description) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, userNickname, email, inviteCode.points_bonus, 'invite', '邀请码注册赠送']
    );
    
    // 同时充值 PH8 余额（邀请码赠送的积分也作为 PH8 余额）
    try {
      await ph8TokenService.rechargeBalance(userId, inviteCode.points_bonus);
      console.log(`[Invite] 用户 ${userId}(${userNickname}) PH8 余额充值成功: ${inviteCode.points_bonus} 积分`);
    } catch (err) {
      console.error('[Invite] PH8 余额充值失败:', err);
      // 不影响注册流程，只记录错误
    }
    
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
