const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 定期清理超过1小时的临时图片
setInterval(() => {
  const now = Date.now();
  fs.readdirSync(UPLOAD_DIR).forEach(f => {
    const fp = path.join(UPLOAD_DIR, f);
    if (now - fs.statSync(fp).mtimeMs > 3600000) fs.unlinkSync(fp);
  });
}, 600000);

// POST /api/upload/image  body: { data: "data:image/png;base64,..." }
router.post('/image', (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'missing data' });

    const match = data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'invalid base64 image' });

    const ext = match[1].split('/')[1];
    const filename = `${uuidv4()}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(match[2], 'base64'));

    const host = `https://${req.get('host')}`;
    res.json({ url: `${host}/api/upload/files/${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/upload/files/:filename
router.get('/files/:filename', (req, res) => {
  const fp = path.join(UPLOAD_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(fp)) return res.status(404).end();
  res.sendFile(fp);
});

module.exports = router;
