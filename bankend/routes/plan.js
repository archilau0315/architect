const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// 获取计划列表
router.get('/list', async (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }
  
  try {
    const [rows] = await db.query(
      'SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个计划
router.get('/:planId', async (req, res) => {
  const { planId } = req.params;
  const userId = req.headers['x-user-id'] || req.query.userId;
  
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }
  
  try {
    const [rows] = await db.query(
      'SELECT * FROM plans WHERE plan_id = ? AND user_id = ?',
      [planId, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '计划不存在' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建计划
router.post('/create', async (req, res) => {
  const { title, description, startDate, endDate, status } = req.body;
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }
  
  if (!title) {
    return res.status(400).json({ error: '计划标题不能为空' });
  }
  
  try {
    const planId = uuidv4();
    await db.query(
      `INSERT INTO plans (plan_id, user_id, title, description, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [planId, userId, title, description || '', startDate, endDate, status || 'pending']
    );
    
    res.json({ 
      success: true, 
      planId, 
      message: '计划创建成功' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新计划
router.put('/:planId', async (req, res) => {
  const { planId } = req.params;
  const { title, description, startDate, endDate, status } = req.body;
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }
  
  try {
    // 检查计划是否存在且属于当前用户
    const [existing] = await db.query(
      'SELECT * FROM plans WHERE plan_id = ? AND user_id = ?',
      [planId, userId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: '计划不存在' });
    }
    
    // 更新计划
    await db.query(
      `UPDATE plans SET title = ?, description = ?, start_date = ?, end_date = ?, status = ?
       WHERE plan_id = ? AND user_id = ?`,
      [title, description || '', startDate, endDate, status || 'pending', planId, userId]
    );
    
    res.json({ 
      success: true, 
      message: '计划更新成功' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除计划
router.delete('/:planId', async (req, res) => {
  const { planId } = req.params;
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }
  
  try {
    // 检查计划是否存在且属于当前用户
    const [existing] = await db.query(
      'SELECT * FROM plans WHERE plan_id = ? AND user_id = ?',
      [planId, userId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: '计划不存在' });
    }
    
    // 删除计划
    await db.query(
      'DELETE FROM plans WHERE plan_id = ? AND user_id = ?',
      [planId, userId]
    );
    
    res.json({ 
      success: true, 
      message: '计划删除成功' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;