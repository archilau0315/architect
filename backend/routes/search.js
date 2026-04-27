const express = require('express');
const router = express.Router();
const searchDispatcher = require('../services/searchDispatcher');
const { authenticateToken } = require('../middleware/auth');

router.post('/web', authenticateToken, async (req, res) => {
  try {
    const { query, force = false, max_results = 8 } = req.body;
    const userTier = req.user?.user_tier || 'free';

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: '搜索词不能为空'
      });
    }

    const result = await searchDispatcher.completeSearch(query, userTier, { max_results });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Search API] 错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器错误'
    });
  }
});

router.post('/complete', authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;
    const userTier = req.user?.user_tier || 'free';

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: '搜索词不能为空'
      });
    }

    const result = await searchDispatcher.completeSearch(query, userTier);

    const response = {
      success: true,
      searched: result.searched,
      reason: result.reason,
      context: result.context || ''
    };

    if (result.error) {
      response.error = result.error;
    }

    if (result.result) {
      response.searchInfo = {
        answer: result.result.answer,
        totalResults: result.result.results.length,
        source: result.source,
        results: result.result.results.map(item => ({
          title: item.title,
          url: item.url,
          score: item.score
        }))
      };
    }

    res.json(response);
  } catch (error) {
    console.error('[Search Complete API] 错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器错误'
    });
  }
});

router.post('/should', authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: '查询内容不能为空'
      });
    }

    const triggerKeywords = [
      '最新', '现在', '今天', '最近', '当前',
      '2024', '2025', '2026', '今年', '本月',
      '新闻', '资讯', '动态', '趋势', '政策',
      '天气', '股价', '汇率', '行情', '数据',
      '资料', '参考', '案例', '案例分析', '行业报告',
      '设计趋势', '市场分析', '竞品分析', '调研报告',
      '如何', '怎么', '教程', '指南', '方法',
      '定义', '是什么', '有哪些', '有什么', '推荐',
      '比较', '对比', '区别', '差异', '优缺点'
    ];

    const lowerQuery = query.toLowerCase();
    const matchedKeywords = [];

    for (const keyword of triggerKeywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }

    res.json({
      success: true,
      shouldSearch: matchedKeywords.length > 0,
      matchedKeywords: matchedKeywords
    });
  } catch (error) {
    console.error('[Search Should API] 错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器错误'
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = searchDispatcher.getStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('[Search Stats API] 错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器错误'
    });
  }
});

router.post('/reset-stats', async (req, res) => {
  try {
    searchDispatcher.resetStats();
    res.json({
      success: true,
      message: '统计数据已重置'
    });
  } catch (error) {
    console.error('[Search Reset API] 错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器错误'
    });
  }
});

module.exports = router;