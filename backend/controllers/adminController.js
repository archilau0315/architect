const db = require('../db');

// 管理员登录
exports.login = async (req, res) => {
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
};

// 获取用户列表
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const [rows] = await db.query(
      'SELECT id, email, nickname, user_tier, daily_points, purchased_points, total_consumed_points, status, created_at FROM `kbit_users` ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM `kbit_users`');
    
    // 转换状态值为可读格式
    const users = rows.map(user => ({
      ...user,
      status: user.status === 1 ? 'active' : 'suspended',
      totalPoints: user.daily_points + user.purchased_points
    }));
    
    res.json({ rows: users, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
};
