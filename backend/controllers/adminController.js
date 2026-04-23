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

    // 查询真实使用统计
    const uid = user.id;

    // 今日统计
    const [todayStats] = await db.query(
      `SELECT COUNT(*) as total_requests, COALESCE(SUM(points_cost), 0) as total_points_spent 
       FROM kbit_usage_logs WHERE user_id=? AND status='success' AND DATE(created_at)=CURDATE()`,
      [uid]
    );
    const todayData = { total_requests: todayStats[0]?.total_requests || 0, total_points_spent: parseInt(todayStats[0]?.total_points_spent) || 0 };

    // 本周统计（7天）
    const [weekStats] = await db.query(
      `SELECT COUNT(*) as total_requests, COALESCE(SUM(points_cost), 0) as total_points_spent 
       FROM kbit_usage_logs WHERE user_id=? AND status='success' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [uid]
    );
    const weekData = { total_requests: weekStats[0]?.total_requests || 0, total_points_spent: parseInt(weekStats[0]?.total_points_spent) || 0 };

    // 近30天每日趋势
    const [daily] = await db.query(
      `SELECT DATE(created_at) as date, 
              COUNT(*) as total_requests, 
              COALESCE(SUM(points_cost), 0) as total_points_spent 
       FROM kbit_usage_logs 
       WHERE user_id=? AND status='success' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`,
      [uid]
    );

    res.json({ success: true, data: { user, usage_stats: { today: todayData, week: weekData, daily } } });
  } catch (err) {
    console.error('[Admin] getUser error:', err);
    res.status(500).json({ error: '服务器错误', message: err.message });
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
    // 基础统计
    const [[{ total_users }]] = await db.query('SELECT COUNT(*) as total_users FROM kbit_users');
    const [[{ active_users }]] = await db.query('SELECT COUNT(*) as active_users FROM kbit_users WHERE status = 1');

    // 今日请求和成本（从日志表查询）
    const todayStart = new Date().toISOString().slice(0, 10) + ' 00:00:00';
    const [todayStats] = await db.query(
      `SELECT COUNT(*) as today_requests, COALESCE(SUM(actual_cost), 0) as today_cost 
       FROM kbit_usage_logs 
       WHERE status='success' AND created_at >= ?`,
      [todayStart]
    );
    const today_requests = todayStats[0]?.today_requests || 0;
    const today_cost = parseFloat(todayStats[0]?.today_cost) || 0;

    // --- 增长率计算 ---
    // 1) 用户增长率：上月末总数 vs 上上月末
    const [prevMonthUsers] = await db.query(
      `SELECT COUNT(*) as cnt FROM kbit_users WHERE created_at < DATE_FORMAT(NOW(), '%Y-%m-01')`
    );
    const [prevPrevMonthUsers] = await db.query(
      `SELECT COUNT(*) as cnt FROM kbit_users WHERE created_at < DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)`
    );
    const pmUsers = prevMonthUsers[0]?.cnt || 0;
    const ppmUsers = prevPrevMonthUsers[0]?.cnt || 0;
    let userGrowth = 0;
    if (ppmUsers > 0) userGrowth = Math.round((pmUsers - ppmUsers) / ppmUsers * 100);

    // 2) 活跃用户增长率：本周活跃 vs 上周活跃（7天滑动窗口）
    const [weekActive] = await db.query(
      `SELECT COUNT(DISTINCT user_id) as cnt FROM kbit_usage_logs 
       WHERE status='success' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND user_id > 0`
    );
    const [prevWeekActive] = await db.query(
      `SELECT COUNT(DISTINCT user_id) as cnt FROM kbit_usage_logs 
       WHERE status='success' AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) 
       AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY) AND user_id > 0`
    );
    const wa = weekActive[0]?.cnt || 0;
    const pwa = prevWeekActive[0]?.cnt || 0;
    let activeGrowth = 0;
    if (pwa > 0) activeGrowth = Math.round((wa - pwa) / pwa * 100);

    // 3) 请求数增长率：今日 vs 昨日
    const [yesterdayStats] = await db.query(
      `SELECT COUNT(*) as cnt FROM kbit_usage_logs 
       WHERE status='success' AND DATE(created_at) = SUBDATE(CURDATE(), 1)`
    );
    const yesterdayReqs = yesterdayStats[0]?.cnt || 0;
    let requestGrowth = 0;
    if (yesterdayReqs > 0) requestGrowth = Math.round((today_requests - yesterdayReqs) / yesterdayReqs * 100);

    // 4) 成本增长率：今日 vs 昨日
    const [yesterdayCost] = await db.query(
      `SELECT COALESCE(SUM(actual_cost), 0) as cost FROM kbit_usage_logs 
       WHERE status='success' AND DATE(created_at) = SUBDATE(CURDATE(), 1)`
    );
    const yCost = parseFloat(yesterdayCost[0]?.cost) || 0;
    let costGrowth = 0;
    if (yCost > 0) costGrowth = Math.round((today_cost - yCost) / yCost * 100);

    // 用户等级分布（支持按时间段筛选新注册用户）
    let tierCondition = '';
    if (req.query.tier_period) {
      switch (req.query.tier_period) {
        case 'week':
          tierCondition = "WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
          break;
        case 'year':
          tierCondition = "WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
          break;
        case 'month':
        default:
          tierCondition = "WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
      }
    }
    const [tier_distribution] = await db.query(`SELECT user_tier, COUNT(*) as count FROM kbit_users ${tierCondition} GROUP BY user_tier`);

    // 功能使用统计（默认今日）
    const period = req.query.period || 'today';
    let dateCondition;
    switch (period) {
      case 'week':
        dateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      default:
        dateCondition = 'AND DATE(created_at) = CURDATE()';
    }
    const [feature_usage] = await db.query(
      `SELECT feature, COUNT(*) as count 
       FROM kbit_usage_logs 
       WHERE status='success' ${dateCondition}
       GROUP BY feature`
    );

    res.json({ success: true, data: { stats: { total_users, active_users, today_requests, today_cost, userGrowth, activeGrowth, requestGrowth, costGrowth }, tier_distribution, feature_usage } });
  } catch (err) {
    console.error('[Dashboard] Error:', err);
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

// 创建系统配置（仅 dev/super/admin）
exports.createConfig = async (req, res) => {
  try {
    const { config_key, config_value, description, category } = req.body;
    if (!config_key) return res.status(400).json({ error: '配置键名不能为空' });

    // 仅允许敏感配置操作的角色
    const allowedRoles = ['dev', 'super', 'admin'];
    if (!allowedRoles.includes(req.admin?.role)) {
      return res.status(403).json({ error: '无权执行此操作，请联系 Dev 管理员' });
    }

    await db.query(
      'INSERT INTO kbit_system_config (config_key, config_value, description, category) VALUES (?, ?, ?, ?)',
      [config_key, config_value || '', description || '', category || 'general']
    );
    res.json({ success: true, message: '配置项已创建' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '该配置键已存在' });
    res.status(500).json({ error: '服务器错误' });
  }
};

// 删除系统配置（仅 dev/super）
exports.deleteConfig = async (req, res) => {
  try {
    const key = req.params.key;

    const allowedRoles = ['dev', 'super'];
    if (!allowedRoles.includes(req.admin?.role)) {
      return res.status(403).json({ error: '无权删除配置，请联系超级管理员' });
    }

    const [result] = await db.query('DELETE FROM kbit_system_config WHERE config_key=?', [key]);
    if (result.affectedRows === 0) return res.status(404).json({ error: '配置不存在' });

    res.json({ success: true, message: '已删除' });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

// 更新系统配置（敏感字段仅允许 dev/super/admin 角色）
exports.updateConfig = async (req, res) => {
  try {
    const { config_value } = req.body;
    const key = req.params.key;

    // 敏感配置项权限检查
    const sensitivePatterns = ['key', 'secret', 'password', 'token', 'api_', 'credential', 'private'];
    const isSensitive = sensitivePatterns.some(p => key.toLowerCase().includes(p));

    if (isSensitive) {
      const allowedRoles = ['dev', 'super', 'admin'];
      if (!allowedRoles.includes(req.admin?.role)) {
        return res.status(403).json({ error: '无权修改此敏感配置，请联系 Dev 管理员' });
      }
    }

    await db.query('UPDATE kbit_system_config SET config_value=?, updated_at=NOW() WHERE config_key=?', [config_value, key]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};
// 获取使用日志（支持筛选：用户ID、功能、状态、日期）
exports.getLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    // 筛选参数
    const userId = req.query.user_id || '';
    const feature = req.query.feature || '';
    const status = req.query.status || '';
    const date = req.query.date || '';

    // 构建动态 WHERE 条件（MySQL 5.7 兼容）
    let where = 'WHERE 1=1';
    const params = [];

    if (userId) { where += ' AND ul.user_id LIKE ?'; params.push('%' + userId + '%'); }
    if (feature) { where += ' AND ul.feature = ?'; params.push(feature); }
    if (status) { where += ' AND ul.status = ?'; params.push(status); }
    if (date) { where += ' AND DATE(ul.created_at) = ?'; params.push(date); }

    // 查询：LEFT JOIN 关联用户表，user_id=0 表示未识别用户
    const [logs] = await db.query(
      `SELECT ul.*,
              CASE WHEN ul.user_id = 0 THEN NULL ELSE u.email END as user_email,
              CASE WHEN ul.user_id = 0 THEN NULL ELSE u.nickname END as user_nickname,
              CASE WHEN ul.user_id = 0 THEN '未识别' ELSE COALESCE(u.nickname, u.email, '未知') END as display_name
       FROM kbit_usage_logs ul
       LEFT JOIN kbit_users u ON ul.user_id = u.id
       ${where} ORDER BY ul.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // 计算总数
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM kbit_usage_logs ul ' + where, params);

    res.json({
      success: true,
      data: { logs, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } }
    });
  } catch (err) {
    console.error('[Admin] getLogs error:', err);
    res.status(500).json({ error: '获取日志失败', message: err.message });
  }
};

// 获取日志可筛选的用户列表（用于下拉选择器）
exports.getLogUsers = async (req, res) => {
  try {
    // 获取有使用记录的用户列表 + 所有注册用户 - MySQL 5.7 兼容
    const [logUsers] = await db.query(
      `SELECT DISTINCT
              CASE WHEN ul.user_id = 0 THEN 0 ELSE COALESCE(ul.user_id, 0) END as user_id,
              CASE WHEN ul.user_id = 0 THEN '未识别用户' ELSE COALESCE(u.nickname, u.email, '未知') END as nickname,
              COALESCE(u.email, '') as email
       FROM kbit_usage_logs ul
       LEFT JOIN kbit_users u ON ul.user_id = u.id
       ORDER BY CASE WHEN ul.user_id = 0 THEN 1 ELSE 0 END, ul.created_at DESC
       LIMIT 100`
    );
    res.json({ success: true, data: { users: logUsers } });
  } catch (err) {
    console.error('[Admin] getLogUsers error:', err);
    res.status(500).json({ error: '获取用户列表失败' });
  }
};
