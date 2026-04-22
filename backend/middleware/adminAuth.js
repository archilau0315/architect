/**
 * 管理员认证中间件
 * 验证请求携带的 JWT token，确保只有已登录管理员可访问管理接口
 */

const jwt = require('jsonwebtoken');

// [安全] 强制从环境变量加载密钥，不允许弱默认值
const JWT_SECRET = process.env.JWT_SECRET;

function verifyAdminToken(req, res, next) {
  // 跳过 options 预检请求
  if (req.method === 'OPTIONS') return next();

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'UNAUTHORIZED',
      message: '缺少管理员令牌' 
    });
  }

  const token = authHeader.replace('Bearer ', '');

  // [安全] 未配置 JWT_SECRET 时拒绝所有请求（防止使用弱默认值）
  if (!JWT_SECRET) {
    console.error('[AdminAuth] FATAL: JWT_SECRET 环境变量未设置');
    return res.status(500).json({
      error: 'SERVER_CONFIG_ERROR',
      message: '服务端配置错误'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // 校验 token 结构：必须包含 id 和 role
    if (!decoded.id) {
      return res.status(401).json({ 
        error: 'INVALID_TOKEN',
        message: '令牌格式无效' 
      });
    }

    // 将解码后的管理员信息附加到请求对象
    req.admin = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role || 'admin'
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'TOKEN_EXPIRED', 
        message: '令牌已过期，请重新登录' 
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'INVALID_TOKEN',
        message: '令牌无效' 
      });
    }
    console.error('[AdminAuth] Token 验证异常:', err.message);
    return res.status(500).json({ 
      error: 'SERVER_ERROR',
      message: '令牌验证失败'
    });
  }
}

module.exports = { verifyAdminToken };
