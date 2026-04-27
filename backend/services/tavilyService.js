const axios = require('axios');

// [安全] 强制从环境变量加载 API Key
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// 需要触发搜索的关键词模式
const SEARCH_TRIGGER_KEYWORDS = [
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

class TavilyService {
  constructor() {
    if (!TAVILY_API_KEY) {
      console.warn('[Tavily] API Key 未配置，搜索功能将不可用');
    }
    this.client = axios.create({
      baseURL: 'https://api.tavily.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  /**
   * 判断是否需要触发联网搜索
   * @param {string} query - 用户提问
   * @returns {boolean} - 是否需要搜索
   */
  shouldSearch(query) {
    if (!query || typeof query !== 'string') return false;
    const lowerQuery = query.toLowerCase();
    return SEARCH_TRIGGER_KEYWORDS.some(keyword => lowerQuery.includes(keyword.toLowerCase()));
  }

  /**
   * 调用 Tavily Search API
   * @param {string} query - 搜索查询词
   * @param {object} options - 搜索选项
   * @returns {object} - 搜索结果
   */
  async search(query, options = {}) {
    if (!TAVILY_API_KEY) {
      return {
        success: false,
        error: 'Tavily API Key 未配置',
        data: null
      };
    }

    if (!query || query.trim().length < 2) {
      return {
        success: false,
        error: '搜索词不能为空',
        data: null
      };
    }

    try {
      const response = await this.client.post('/v1/search', {
        query: query.trim(),
        search_depth: options.search_depth || 'advanced',
        max_results: options.max_results || 8,
        include_answer: options.include_answer || true,
        include_raw_content: options.include_raw_content || false,
        include_images: true,
        ...options
      }, {
        headers: {
          'Authorization': `Bearer ${TAVILY_API_KEY}`
        }
      });

      console.log('[Tavily] API Response:', JSON.stringify(response.data).substring(0, 500));

      if (response.data && response.data.results) {
        return {
          success: true,
          error: null,
          data: this.parseResponse(response.data)
        };
      } else {
        return {
          success: false,
          error: '搜索返回格式错误',
          data: null
        };
      }
    } catch (error) {
      console.error('[Tavily] 搜索失败:', error.message, error.response?.data);
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data || error.message || '搜索失败',
        data: null
      };
    }
  }

  /**
   * 解析 Tavily API 返回结果
   * @param {object} response - API返回数据
   * @returns {object} - 结构化结果
   */
  parseResponse(response) {
    const result = {
      answer: response.answer || '',
      question: response.question || '',
      searchQuery: response.search_query || '',
      results: [],
      rawResponse: response,
      topLevelImages: response.images || []
    };

    if (response.results && Array.isArray(response.results)) {
      result.results = response.results.map((item, index) => {
        const imageUrl = item.image_url || item.image || item.img || null;
        if (index === 0) {
          console.log('[Tavily] Result item keys:', Object.keys(item));
          console.log('[Tavily] Image URL found:', imageUrl);
        }
        return ({
          title: item.title || '',
          url: item.url || '',
          content: item.content || '',
          score: item.score || 0,
          publishedDate: item.published_date || null,
          author: item.author || null,
          imageUrl: imageUrl,
          rawData: item
        });
      });
    }

    const totalImages = result.results.filter(r => r.imageUrl).length;
    console.log('[Tavily] Total images found:', totalImages);
    console.log('[Tavily] Top level images:', response.images);
    
    return result;
  }

  /**
   * 内容安全过滤（简单实现，可扩展）
   * @param {string} content - 要过滤的内容
   * @returns {object} - 过滤结果
   */
  async filterContent(content) {
    if (!content) {
      return { safe: true, content: '', reason: '内容为空' };
    }

    // 敏感词列表（可扩展）
    const sensitiveWords = [
      '色情', '暴力', '赌博', '毒品', '恐怖', '政治',
      '违法', '违规', '不良', '敏感', '反动', '谣言'
    ];

    const lowerContent = content.toLowerCase();
    const foundSensitive = sensitiveWords.filter(word => lowerContent.includes(word));

    if (foundSensitive.length > 0) {
      return {
        safe: false,
        content: '',
        reason: `包含敏感内容: ${foundSensitive.join(', ')}`
      };
    }

    return {
      safe: true,
      content: content,
      reason: '内容安全'
    };
  }

  /**
   * 获取搜索结果的上下文摘要
   * @param {object} searchResult - 搜索结果
   * @returns {string} - 上下文摘要
   */
  getContextSummary(searchResult) {
    if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
      return '';
    }

    const summaries = searchResult.results.slice(0, 5).map((item, index) => {
      const dateStr = item.publishedDate ? ` (${item.publishedDate})` : '';
      const imageInfo = item.imageUrl ? `\n图片: ${item.imageUrl}` : '';
      return `${index + 1}. [${item.title}${dateStr}] ${item.content.slice(0, 150)}...\n来源: ${item.url}${imageInfo}`;
    });

    return `联网搜索结果（共${searchResult.results.length}条）:\n\n${summaries.join('\n\n')}`;
  }

  /**
   * 完整搜索流程：判断 -> 搜索 -> 过滤 -> 整理
   * @param {string} query - 用户提问
   * @returns {object} - 完整结果
   */
  async completeSearch(query) {
    // 1. 判断是否需要搜索
    const needsSearch = this.shouldSearch(query);
    
    if (!needsSearch) {
      return {
        searched: false,
        reason: '提问不需要实时信息',
        result: null,
        context: ''
      };
    }

    // 2. 执行搜索
    const searchResult = await this.search(query);
    
    if (!searchResult.success) {
      return {
        searched: true,
        reason: '搜索执行但失败',
        result: null,
        context: '',
        error: searchResult.error
      };
    }

    // 3. 内容安全过滤
    const filteredResults = [];
    for (const result of searchResult.data.results) {
      const filterResult = await this.filterContent(result.content);
      if (filterResult.safe) {
        filteredResults.push(result);
      }
    }

    searchResult.data.results = filteredResults;

    // 4. 生成上下文
    const context = this.getContextSummary(searchResult.data);

    return {
      searched: true,
      reason: '需要实时信息，已执行搜索',
      result: searchResult.data,
      context: context,
      error: null
    };
  }
}

module.exports = new TavilyService();