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
    // 【新增】每次获取用户列表前先自动检查并降级过期用户
    const ph8TokenService = require('../services/ph8TokenService');
    await ph8TokenService.checkTierExpiry();
    
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
      `SELECT id, email, nickname, user_tier, total_earned, total_points, daily_quota, daily_used, tier_expires_at, status, last_login_at, created_at,
              (SELECT COALESCE(SUM(points_cost), 0) FROM kbit_usage_logs WHERE user_id = kbit_users.id AND status='success') as consumed_points
       FROM kbit_users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
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
      `SELECT COUNT(*) as total_requests, COALESCE(SUM(points_cost), 0) as total_points_spent, COALESCE(SUM(actual_cost), 0) as total_actual_cost 
       FROM kbit_usage_logs WHERE user_id=? AND status='success' AND DATE(created_at)=CURDATE()`,
      [uid]
    );
    const todayData = {
      total_requests: todayStats[0]?.total_requests || 0,
      total_points_spent: parseInt(todayStats[0]?.total_points_spent) || 0,
      total_actual_cost: parseFloat(todayStats[0]?.total_actual_cost) || 0
    };

    // 本周统计（7天）
    const [weekStats] = await db.query(
      `SELECT COUNT(*) as total_requests, COALESCE(SUM(points_cost), 0) as total_points_spent, COALESCE(SUM(actual_cost), 0) as total_actual_cost 
       FROM kbit_usage_logs WHERE user_id=? AND status='success' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [uid]
    );
    const weekData = {
      total_requests: weekStats[0]?.total_requests || 0,
      total_points_spent: parseInt(weekStats[0]?.total_points_spent) || 0,
      total_actual_cost: parseFloat(weekStats[0]?.total_actual_cost) || 0
    };

    // 本月统计（30天）
    const [monthStats] = await db.query(
      `SELECT COUNT(*) as total_requests, COALESCE(SUM(points_cost), 0) as total_points_spent, COALESCE(SUM(actual_cost), 0) as total_actual_cost 
       FROM kbit_usage_logs WHERE user_id=? AND status='success' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [uid]
    );
    const monthData = {
      total_requests: monthStats[0]?.total_requests || 0,
      total_points_spent: parseInt(monthStats[0]?.total_points_spent) || 0,
      total_actual_cost: parseFloat(monthStats[0]?.total_actual_cost) || 0
    };

    // 历史总统计
    const [totalStats] = await db.query(
      `SELECT COUNT(*) as total_requests, COALESCE(SUM(points_cost), 0) as total_points_spent, COALESCE(SUM(actual_cost), 0) as total_actual_cost 
       FROM kbit_usage_logs WHERE user_id=? AND status='success'`,
      [uid]
    );
    const totalData = {
      total_requests: totalStats[0]?.total_requests || 0,
      total_points_spent: parseInt(totalStats[0]?.total_points_spent) || 0,
      total_actual_cost: parseFloat(totalStats[0]?.total_actual_cost) || 0
    };

    // 近30天每日趋势
    const [daily] = await db.query(
      `SELECT DATE(created_at) as date, 
              COUNT(*) as total_requests, 
              COALESCE(SUM(points_cost), 0) as total_points_spent, 
              COALESCE(SUM(actual_cost), 0) as total_actual_cost 
       FROM kbit_usage_logs 
       WHERE user_id=? AND status='success' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`,
      [uid]
    );

    res.json({ success: true, data: { user, usage_stats: { today: todayData, week: weekData, month: monthData, total: totalData, daily } } });
  } catch (err) {
    console.error('[Admin] getUser error:', err);
    res.status(500).json({ error: '服务器错误', message: err.message });
  }
};

// 更新用户
exports.updateUser = async (req, res) => {
  try {
    const { user_tier, status, tier_expires_at, total_points, daily_quota } = req.body;
    await db.query(
      'UPDATE kbit_users SET user_tier=?, status=?, tier_expires_at=?, total_points=?, daily_quota=? WHERE id=?',
      [user_tier, status, tier_expires_at || null, total_points, daily_quota, req.params.id]
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
    const [applications] = await db.query('SELECT * FROM beta_applications WHERE id=?', [req.params.id]);
    if (applications.length === 0) {
      return res.status(404).json({ error: '申请不存在' });
    }

    const application = applications[0];
    if (application.status !== 'pending') {
      return res.status(400).json({ error: '该申请已被处理' });
    }

    const inviteCode = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db.query(
      'INSERT INTO invite_codes (code, created_by, points_bonus, tier, expires_at) VALUES (?, ?, ?, ?, ?)',
      [inviteCode, 'admin', 1000, 'beta', expiresAt]
    );

    await db.query(
      'UPDATE beta_applications SET status="approved", invite_code=?, approved_at=NOW() WHERE id=?',
      [inviteCode, req.params.id]
    );

    try {
      const mailService = require('../services/mailService');
      await mailService.sendInviteCode(application.email, inviteCode);
      console.log(`[内测申请] 邀请码已发送至: ${application.email}`);
    } catch (mailError) {
      console.error('[内测申请] 邮件发送失败:', mailError);
    }

    res.json({ success: true, inviteCode });
  } catch (err) {
    console.error('[审批内测申请 Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

    // 查询：先获取日志，再逐个匹配用户（更稳妥）
    const [logs] = await db.query(
      `SELECT * FROM kbit_usage_logs ul
       ${where} ORDER BY ul.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    
    // 补充用户信息 - 优先使用表内冗余字段，为空时再查 kbit_users
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      let user_email = log.user_email || null;
      let user_nickname = log.user_nickname || null;
      let display_name = '未识别';
      
      // 如果表内已有昵称/邮箱数据，直接使用
      if (user_nickname || user_email) {
        display_name = user_nickname || user_email || '未知用户';
      }
      // 否则通过 user_id 查询 kbit_users 补充
      else if (log.user_id && log.user_id !== 0 && log.user_id !== '0' && log.user_id !== 'guest' && log.user_id !== '未识别') {
        try {
          const [users] = await db.query(
            'SELECT id, nickname, email FROM kbit_users WHERE id = ? OR email = ? LIMIT 1',
            [log.user_id, log.user_id]
          );
          
          if (users.length > 0) {
            user_email = users[0].email;
            user_nickname = users[0].nickname;
            display_name = user_nickname || user_email || '未知用户';
          } else if (typeof log.user_id === 'string' && log.user_id.includes('@')) {
            display_name = log.user_id;
            user_email = log.user_id;
          } else {
            display_name = '未知用户';
          }
        } catch (e) {
          console.error('[Admin] 查询用户信息失败:', e);
        }
      }
      
      logs[i].user_email = user_email;
      logs[i].user_nickname = user_nickname;
      logs[i].display_name = display_name;
    }

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

// 修改管理员密码
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const adminId = req.admin.id;

    // 参数校验
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请输入旧密码和新密码' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: '新密码至少需要8个字符' });
    }

    // 验证旧密码
    const [[admin]] = await db.query('SELECT password_hash, username FROM admins WHERE id = ?', [adminId]);
    if (!admin) {
      return res.status(404).json({ error: '管理员不存在' });
    }

    const isValid = await bcrypt.compare(oldPassword, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    // 检查新密码是否与旧密码相同
    if (await bcrypt.compare(newPassword, admin.password_hash)) {
      return res.status(400).json({ error: '新密码不能与旧密码相同' });
    }

    // 更新新密码
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE admins SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, adminId]);

    console.log(`[Admin] 管理员 ${admin.username} 已修改密码`);
    res.json({ success: true, message: '密码修改成功，请重新登录' });
  } catch (err) {
    console.error('[Admin] 修改密码失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 管理员找回密码（发送重置链接）
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: '请输入邮箱地址' });
    }

    // 查找管理员
    const [[admin]] = await db.query('SELECT id, username, email FROM admins WHERE email = ?', [email]);
    if (!admin) {
      return res.status(404).json({ error: '未找到该邮箱对应的管理员' });
    }

    // 生成重置令牌
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1小时后过期

    // 先删除该邮箱之前的重置令牌
    await db.query('DELETE FROM password_reset_tokens WHERE email = ?', [email]);

    // 存储新令牌
    await db.query(
      'INSERT INTO password_reset_tokens (email, token, expires_at, user_type) VALUES (?, ?, ?, ?)',
      [email, token, expiresAt, 'admin']
    );

    // 构建重置链接（指向后端服务的管理员重置密码页面）
    const apiUrl = 'https://www.kbitai.com.cn';
    const resetUrl = `${apiUrl}/admin/reset-password.html?token=${token}`;

    // 发送邮件（如果配置了邮件服务）
    try {
      const mailService = require('../services/mailService');
      await mailService.sendPasswordResetEmail(email, admin.username, resetUrl);
    } catch (mailErr) {
      console.warn('[Admin] 发送重置邮件失败:', mailErr.message);
    }

    console.log(`[Admin] 管理员 ${admin.username} 申请密码重置，重置链接已生成`);
    res.json({ success: true, message: '重置链接已发送到您的邮箱，请在1小时内完成重置' });
  } catch (err) {
    console.error('[Admin] 找回密码失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 管理员重置密码（通过令牌）
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: '请提供重置令牌和新密码' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: '新密码至少需要8个字符' });
    }

    // 验证令牌
    const [[resetToken]] = await db.query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND expires_at > NOW() AND used_at IS NULL AND user_type = ?',
      [token, 'admin']
    );

    if (!resetToken) {
      return res.status(400).json({ error: '无效的重置链接或链接已过期' });
    }

    // 查找管理员
    const [[admin]] = await db.query('SELECT id, username FROM admins WHERE email = ?', [resetToken.email]);
    if (!admin) {
      return res.status(404).json({ error: '管理员不存在' });
    }

    // 更新密码
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE admins SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, admin.id]);

    // 标记令牌已使用
    await db.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ?', [token]);

    console.log(`[Admin] 管理员 ${admin.username} 已通过重置链接修改密码`);
    res.json({ success: true, message: '密码重置成功，请使用新密码登录' });
  } catch (err) {
    console.error('[Admin] 重置密码失败:', err);
    res.status(500).json({ error: '服务器错误' });
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

// 手动发送邀请码
exports.manualSendInvite = async (req, res) => {
  try {
    const { email, inviteCode } = req.body;

    if (!email || !inviteCode) {
      return res.status(400).json({ error: '请提供邮箱和邀请码' });
    }

    // 验证邀请码是否存在且有效
    const [codeRows] = await db.query(
      'SELECT * FROM invite_codes WHERE code = ?',
      [inviteCode]
    );

    if (codeRows.length === 0) {
      return res.status(400).json({ error: '邀请码不存在' });
    }

    // 发送邮件
    const mailService = require('../services/mailService');
    const sendResult = await mailService.sendInviteCode(email, inviteCode);

    if (sendResult) {
      console.log(`[手动发送邀请码] 已将邀请码 ${inviteCode} 发送至 ${email}`);
      res.json({ success: true, message: '邀请码已发送' });
    } else {
      res.status(500).json({ error: '邮件发送失败' });
    }
  } catch (err) {
    console.error('[Admin] manualSendInvite error:', err);
    res.status(500).json({ error: '服务器错误', message: err.message });
  }
};
