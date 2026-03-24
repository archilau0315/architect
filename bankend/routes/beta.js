const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/apply', async (req, res) => {
  const { name, email, phone, company, purpose, experience, appliedAt } = req.body;

  if (!name || !email || !purpose) {
    return res.status(400).json({ error: '缺少必要信息' });
  }

  try {
    const [existing] = await db.query(
      'SELECT id FROM beta_applications WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: '该邮箱已提交过申请' });
    }

    await db.query(
      `INSERT INTO beta_applications (name, email, phone, company, purpose, experience, applied_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone || '', company || '', purpose, experience || '', appliedAt, 'pending']
    );

    res.json({ success: true, message: '申请提交成功' });
  } catch (err) {
    console.error('[Beta Apply Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/status/:email', async (req, res) => {
  const { email } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT status, applied_at FROM beta_applications WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.json({ status: 'not_applied' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[Beta Status Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/list', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM beta_applications ORDER BY applied_at DESC LIMIT 50'
    );
    res.json(rows);
  } catch (err) {
    console.error('[Beta List Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/approve', async (req, res) => {
  const { email, tier } = req.body;

  try {
    await db.query(
      'UPDATE beta_applications SET status = ?, approved_at = NOW() WHERE email = ?',
      [tier || 'beta', email]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Beta Approve Error]', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
