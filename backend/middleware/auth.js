const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const [users] = await db.query('SELECT id, email, user_tier FROM kbit_users WHERE id = ?', [decoded.userId]);
    
    if (users.length === 0) {
      req.user = null;
      return next();
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error('[Auth] Token验证失败:', error.message);
    req.user = null;
    next();
  }
}

module.exports = {
  authenticateToken
};