const validator = require('validator');

// 不需要清理的字段（base64 图片/视频数据、媒体类型）
const SKIP_SANITIZE_KEYS = new Set(['image', 'video', 'data', 'base64', 'imageData', 'videoData', 'reference_images', 'mimeType', 'mime_type']);

// 输入清理函数
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return validator.escape(input.trim());
  }
  return input;
};

// 递归清理对象中的所有字符串属性
const sanitizeObject = (obj, key = '') => {
  if (typeof obj !== 'object' || obj === null) {
    // 跳过白名单字段（base64 数据、媒体类型等）
    if (SKIP_SANITIZE_KEYS.has(key)) return obj;
    return sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, key));
  }

  const sanitized = {};
  for (const [k, value] of Object.entries(obj)) {
    sanitized[k] = sanitizeObject(value, k);
  }
  return sanitized;
};

// 验证邮箱格式
const validateEmail = (email) => {
  return validator.isEmail(email);
};

// 验证手机号格式（中国）
const validatePhone = (phone) => {
  return validator.isMobilePhone(phone, 'zh-CN');
};

// 验证密码强度
const validatePassword = (password) => {
  // 至少8位，包含字母和数字
  return validator.isLength(password, { min: 8 }) && 
         /[a-zA-Z]/.test(password) && 
         /\d/.test(password);
};

// 验证用户ID格式
const validateUserId = (userId) => {
  if (!userId) return false;
  // 接受纯数字ID（数据库中的BIGINT格式）
  if (/^\d+$/.test(userId.toString())) return true;
  // 也接受字母数字混合的字符串ID
  if (typeof userId === 'string') {
    return validator.isAlphanumeric(userId.replace(/[_-]/g, ''));
  }
  return false;
};

// 验证积分数量
const validatePoints = (points) => {
  return validator.isInt(points.toString(), { min: 0, max: 1000000 });
};

// 请求验证中间件
const validateRequest = (req, res, next) => {
  // 代理转发路径跳过清理（base64 数据会被 validator.escape 破坏）
  if (!req.path.startsWith('/api/ph8/') && !req.path.startsWith('/api/gateway/')) {
    // 清理请求体
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
  }
  
  // 清理查询参数
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // 清理路由参数
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// 登录请求验证
const validateLoginRequest = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }
  
  if (!validateEmail(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  
  if (!validatePassword(password)) {
    return res.status(400).json({ error: '密码格式不正确，至少8位，包含字母和数字' });
  }
  
  next();
};

// 注册请求验证
const validateRegisterRequest = (req, res, next) => {
  const { email, password, phone, nickname } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }
  
  if (!validateEmail(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  
  if (!validatePassword(password)) {
    return res.status(400).json({ error: '密码格式不正确' });
  }
  
  if (phone && !validatePhone(phone)) {
    return res.status(400).json({ error: '手机号格式不正确' });
  }
  
  if (nickname && !validator.isLength(nickname, { min: 1, max: 64 })) {
    return res.status(400).json({ error: '昵称长度应在1-64个字符之间' });
  }
  
  next();
};

// 消耗积分请求验证
const validateConsumePointsRequest = (req, res, next) => {
  const { amount, description } = req.body;
  
  if (amount === undefined || amount === null) {
    return res.status(400).json({ error: '积分数量不能为空' });
  }
  
  if (!validatePoints(amount)) {
    return res.status(400).json({ error: '积分数量格式不正确' });
  }
  
  if (description && !validator.isLength(description, { max: 255 })) {
    return res.status(400).json({ error: '描述长度不能超过255个字符' });
  }
  
  next();
};

// 用户ID验证中间件
const validateUserIdParam = (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.query.userId || req.params.userId;
  
  if (userId && !validateUserId(userId)) {
    return res.status(400).json({ error: '用户ID格式不正确' });
  }
  
  next();
};

// SQL注入检测
const detectSqlInjection = (input) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE|CAST)\b)/i,
    /(\b(OR|AND)\b\s*\d+\s*=\s*\d+)/i,
    /(--|#|\/\*|\*\/)/,
    /(\bWAITFOR\b\s+\bDELAY\b)/i,
    /(\bBENCHMARK\b\s*\()/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
};

// SQL注入防护中间件
// 注意：/api/ph8/ 路径跳过此检测，因为 PH8 是代理转发（不操作数据库），base64 数据会误触发正则
const sqlInjectionProtection = (req, res, next) => {
  // 代理转发路径直接放行（不涉及数据库操作）
  if (req.path.startsWith('/api/ph8/') || req.path.startsWith('/api/gateway/')) {
    return next();
  }
  
  const checkSqlInjection = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string') {
        if (value.length < 500 && detectSqlInjection(value)) {
          throw new Error(`检测到潜在的SQL注入攻击: ${currentPath}`);
        }
      } else if (typeof value === 'object' && value !== null) {
        checkSqlInjection(value, currentPath);
      }
    }
  };
  
  try {
    if (req.body) checkSqlInjection(req.body);
    if (req.query) checkSqlInjection(req.query);
    if (req.params) checkSqlInjection(req.params);
    next();
  } catch (error) {
    console.error('SQL注入检测:', error.message);
    return res.status(403).json({ error: '请求包含非法字符' });
  }
};

module.exports = {
  validateRequest,
  validateLoginRequest,
  validateRegisterRequest,
  validateConsumePointsRequest,
  validateUserIdParam,
  sqlInjectionProtection,
  sanitizeInput,
  validateEmail,
  validatePhone,
  validatePassword,
};
