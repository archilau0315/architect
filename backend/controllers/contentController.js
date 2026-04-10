const db = require('../db');

// 注册内容
exports.registerContent = async (req, res) => {
  const { contentId, contentType, userId, metadata } = req.body;
  
  try {
    await db.query(
      'INSERT INTO content_registry (content_id, content_type, user_id, metadata) VALUES (?, ?, ?, ?)',
      [contentId, contentType, userId, JSON.stringify(metadata || {})]
    );
    
    res.json({ success: true, contentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 验证内容
exports.verifyContent = async (req, res) => {
  const { contentId } = req.params;
  
  try {
    const [rows] = await db.query(
      'SELECT * FROM content_registry WHERE content_id = ?',
      [contentId]
    );
    
    if (rows.length === 0) {
      return res.json({ found: false });
    }
    
    res.json({ found: true, content: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
};

// 记录下载日志
exports.logDownload = async (req, res) => {
  const { contentId, contentType, userId, downloadType, metadata } = req.body;
  
  try {
    await db.query(
      'INSERT INTO download_logs (content_id, content_type, user_id, download_type, metadata, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [contentId, contentType, userId, downloadType || 'standard', JSON.stringify(metadata || {}), req.ip || req.connection.remoteAddress, req.headers['user-agent'] || '']
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
};
