const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// [安全修复] 强制从环境变量加载，不允许弱默认值
// 如果未设置 JWT_SECRET，服务启动时应直接退出（见 server.js 启动校验）
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[FATAL] 管理员认证: JWT_SECRET 环境变量未设置！管理员功能将不可用。');
  console.error('[FATAL] 请在 backend/.env 中设置: JWT_SECRET=你的强密钥(至少32位随机字符)');
}

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
    const isValid = await bcrypt.compare(password, admin.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    await db.query(
      'UPDATE admins SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
      [req.ip || req.connection.remoteAddress, admin.id]
    );

    // [安全修复] JWT_SECRET 未配置时拒绝登录
    if (!JWT_SECRET) {
      return res.status(500).json({ error: '服务端认证配置错误，请联系管理员' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        admin: { id: admin.id, username: admin.username, role: admin.role }
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
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const tier = req.query.tier || '';
    const status = req.query.status || '';

    let where = 'WHERE 1=1';
    const params = [];
    if (search) { where += ' AND (email LIKE ? OR nickname LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (tier) { where += ' AND user_tier = ?'; params.push(tier); }
    if (status !== '') { where += ' AND status = ?'; params.push(parseInt(status)); }

    const [rows] = await db.query(
      `SELECT id, email, nickname, user_tier, daily_points, purchased_points, total_consumed_points, tier_expires_at, status, last_login_at, created_at FROM kbit_users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM kbit_users ${where}`, params);

    res.json({ success: true, data: { users: rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 获取单个用户
exports.getUser = async (req, res) => {
  try {
    const [[user]] = await db.query('SELECT * FROM kbit_users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const usage_stats = { today: { total_requests: 0, total_points_spent: 0 }, week: { total_requests: 0, total_points_spent: 0 }, daily: [] };
    res.json({ success: true, data: { user, usage_stats } });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

// 更新用户
exports.updateUser = async (req, res) => {
  try {
    const { user_tier, status, tier_expires_at, daily_points, purchased_points } = req.body;
    await db.query(
      'UPDATE kbit_users SET user_tier=?, status=?, tier_expires_at=?, daily_points=?, purchased_points=? WHERE id=?',
      [user_tier, status, tier_expires_at || null, daily_points, purchased_points, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

// 删除用户
exports.deleteUser = async (req, res) => {
  try {
    await db.query('DELETE FROM kbit_users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

// 仪表盘统计
exports.getDashboard = async (req, res) => {
  try {
    const [[{ total_users }]] = await db.query('SELECT COUNT(*) as total_users FROM kbit_users');
    const [[{ active_users }]] = await db.query('SELECT COUNT(*) as active_users FROM kbit_users WHERE status = 1');
    const [tier_distribution] = await db.query('SELECT user_tier, COUNT(*) as count FROM kbit_users GROUP BY user_tier');
    res.json({ success: true, data: { stats: { total_users, active_users, today_requests: 0, today_cost: 0 }, tier_distribution, feature_usage: [] } });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

// 获取内测申请列表
exports.getBetaRequests = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM beta_applications ORDER BY applied_at DESC');
    res.json({ success: true, data: { requests: rows } });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

// 审批内测申请
exports.approveBetaRequest = async (req, res) => {
  try {
    await db.query('UPDATE beta_applications SET status="approved", approved_at=NOW() WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

// 拒绝内测申请
exports.rejectBetaRequest = async (req, res) => {
  try {
    await db.query('UPDATE beta_applications SET status="rejected" WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

// 获取系统配置
exports.getConfigs = async (req, res) => {
  try {
    const category = req.query.category || '';
    let where = category ? 'WHERE category = ?' : '';
    const [rows] = await db.query(`SELECT * FROM kbit_system_config ${where} ORDER BY category, config_key`, category ? [category] : []);
    // 按 category 分组
    const configs = {};
    rows.forEach(r => {
      if (!configs[r.category]) configs[r.category] = [];
      configs[r.category].push(r);
    });
    res.json({ success: true, data: { configs } });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

// 更新系统配置
exports.updateConfig = async (req, res) => {
  try {
    const { config_value } = req.body;
    await db.query('UPDATE kbit_system_config SET config_value=?, updated_at=NOW() WHERE config_key=?', [config_value, req.params.key]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};
exports.getLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const [logs] = await db.query(
      'SELECT ul.*, u.email FROM kbit_usage_logs ul LEFT JOIN kbit_users u ON ul.user_id = u.id ORDER BY ul.created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM kbit_usage_logs');
    res.json({ success: true, data: { logs, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } } });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};
