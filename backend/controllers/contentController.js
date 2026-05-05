const db = require('../db');

// 注册内容（Image beacon 静默追踪，永不报错）
exports.registerContent = async (req, res) => {
  try {
    let contentId, contentType, userId, metadata;

    if (req.method === 'POST' && req.body) {
      ({ contentId, contentType, userId, metadata } = req.body);
    } else if (req.query && req.query.d) {
      try {
        const parsed = JSON.parse(decodeURIComponent(req.query.d));
        ({ contentId, contentType, userId, metadata } = parsed);
      } catch (e) {
        return res.json({ success: true, skipped: 'parse_error' });
      }
    }

    if (!contentId) {
      return res.json({ success: true, skipped: 'no_contentId' });
    }

    await db.query(
      'INSERT INTO content_registry (content_id, content_type, user_id, metadata) VALUES (?, ?, ?, ?)',
      [contentId, contentType || 'unknown', userId || null, JSON.stringify(metadata || {})]
    );

    res.json({ success: true, contentId });
  } catch (err) {
    // beacon 追踪接口：DB 错误也返回 200，避免控制台报红
    console.error('[Content Register] DB错误(静默):', err.message?.substring(0, 100));
    res.json({ success: false, error: 'db_error' });
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
