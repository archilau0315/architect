const express = require('express');
const router = express.Router();
const tavilyService = require('../services/tavilyService');

/**
 * @api {post} /api/search/web 执行联网搜索
 * @apiDescription 根据用户提问执行联网搜索，自动判断是否需要搜索
 * @apiGroup Search
 * @apiParam {string} query 用户提问内容
 * @apiParam {boolean} [force=false] 是否强制搜索（忽略自动判断）
 * @apiParam {number} [max_results=8] 最大搜索结果数量
 * @apiParam {string} [search_depth=advanced] 搜索深度（basic/advanced）
 * @apiSuccess {boolean} searched 是否执行了搜索
 * @apiSuccess {string} reason 搜索原因
 * @apiSuccess {object} [result] 搜索结果
 * @apiSuccess {string} [context] 上下文摘要（用于送入大模型）
 * @apiSuccess {string} [error] 错误信息（如有）
 */
router.post('/web', async (req, res) => {
  try {
    const { query, force = false, max_results = 8, search_depth = 'advanced' } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: '搜索词不能为空'
      });
    }

    // 判断是否需要搜索
    let searchResult;
    if (force) {
      // 强制搜索
      const result = await tavilyService.search(query, { max_results, search_depth });
      if (result.success) {
        // 内容安全过滤
        const filteredResults = [];
        for (const item of result.data.results) {
          const filterResult = await tavilyService.filterContent(item.content);
          if (filterResult.safe) {
            filteredResults.push(item);
          }
        }
        result.data.results = filteredResults;
        // 提取搜索结果中的图片URL（从每个结果项和顶层images字段）
          const imagesFromResults = result.data.results
            .filter(item => item.imageUrl && item.imageUrl.startsWith('http'))
            .map(item => item.imageUrl);
          
          // 顶层images字段可能是字符串或数组
          const imagesFromTopLevel = [];
          if (result.data.topLevelImages) {
            if (Array.isArray(result.data.topLevelImages)) {
              imagesFromTopLevel.push(...result.data.topLevelImages.filter(img => img && img.startsWith('http')));
            } else if (typeof result.data.topLevelImages === 'string' && result.data.topLevelImages.startsWith('http')) {
              imagesFromTopLevel.push(result.data.topLevelImages);
            }
          }
          
          const images = [...new Set([...imagesFromResults, ...imagesFromTopLevel])];
          
          searchResult = {
            searched: true,
            reason: '强制执行搜索',
            result: result.data,
            context: tavilyService.getContextSummary(result.data),
            images: images,
            error: null
          };
      } else {
        searchResult = {
          searched: true,
          reason: '搜索执行但失败',
          result: null,
          context: '',
          error: result.error
        };
      }
    } else {
      // 自动判断并执行搜索
      searchResult = await tavilyService.completeSearch(query);
    }

    res.json({
      success: true,
      ...searchResult
    });
  } catch (error) {
    console.error('[Search API] 错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器错误'
    });
  }
});

/**
 * @api {post} /api/search/complete 完整搜索流程（带上下文生成）
 * @apiDescription 执行搜索并返回可直接用于大模型的完整上下文
 * @apiGroup Search
 * @apiParam {string} query 用户提问内容
 * @apiSuccess {boolean} success 是否成功
 * @apiSuccess {string} context 整理好的搜索上下文（可直接送入大模型）
 * @apiSuccess {object} [searchInfo] 搜索详情
 */
router.post('/complete', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: '搜索词不能为空'
      });
    }

    // 执行完整搜索流程
    const result = await tavilyService.completeSearch(query);

    // 构建最终响应
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

/**
 * @api {post} /api/search/should 预测是否需要搜索
 * @apiDescription 判断用户提问是否需要触发联网搜索
 * @apiGroup Search
 * @apiParam {string} query 用户提问内容
 * @apiSuccess {boolean} shouldSearch 是否需要搜索
 * @apiSuccess {string[]} matchedKeywords 匹配的触发关键词
 */
router.post('/should', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: '查询内容不能为空'
      });
    }

    // 判断是否需要搜索
    const lowerQuery = query.toLowerCase();
    const matchedKeywords = [];
    
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

module.exports = router;