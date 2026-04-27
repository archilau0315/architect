const baiduSearch = require('./baiduSearchService');
const tavilyService = require('./tavilyService');

const PRO_TIER = ['pro', 'plus'];
const CHINESE_CONTEXT_KEYWORDS = [
  '中文', '国风', '中式', '中国', '国内', '本土', '传统', 
  '古典', '江南', '东方', '故宫', '长城', '四合院', '园林',
  '中式建筑', '国内景观', '国产设计', '水墨画', '书法', '国画'
];
const OVERSEAS_CONTEXT_KEYWORDS = [
  '英文', '北欧', '极简', '欧式', '日式', '赛博朋克', 
  '欧美', '国际', '海外', '西方', '现代', '抽象', '印象派',
  '欧美建筑', '国际艺术', '海外设计', '哥特', '巴洛克', '包豪斯'
];

class SearchDispatcher {
  constructor() {
    this.stats = {
      totalRequests: 0,
      baiduRequests: 0,
      tavilyRequests: 0,
      baiduFallbackRequests: 0,
      tavilyFallbackRequests: 0,
      errors: 0,
      lastResetTime: Date.now()
    };
    this.maxTavilyCallsPerDay = 1000;
    this.tavilyTodayCalls = new Map();
  }

  isProTier(userTier) {
    return PRO_TIER.includes(userTier);
  }

  detectContext(query) {
    const lowerQuery = query.toLowerCase();
    
    const hasChinese = CHINESE_CONTEXT_KEYWORDS.some(kw => lowerQuery.includes(kw.toLowerCase()));
    const hasOverseas = OVERSEAS_CONTEXT_KEYWORDS.some(kw => lowerQuery.includes(kw.toLowerCase()));
    
    if (hasChinese && hasOverseas) {
      return 'chinese';
    } else if (hasChinese) {
      return 'chinese';
    } else if (hasOverseas) {
      return 'overseas';
    } else {
      return 'default';
    }
  }

  determineSearchSource(userTier, query) {
    if (!this.isProTier(userTier)) {
      return { source: 'baidu', reason: '普通用户强制走百度' };
    }

    const context = this.detectContext(query);
    
    if (context === 'chinese') {
      return { source: 'baidu', reason: 'Pro用户-中文场景-走百度' };
    } else if (context === 'overseas') {
      return { source: 'tavily', reason: 'Pro用户-海外场景-走Tavily' };
    } else {
      return { source: 'baidu', reason: 'Pro用户-默认场景-走百度' };
    }
  }

  async canUseTavily() {
    const today = new Date().toISOString().split('T')[0];
    const todayCalls = this.tavilyTodayCalls.get(today) || 0;
    
    if (todayCalls >= this.maxTavilyCallsPerDay) {
      return { allowed: false, reason: '今日免费额度已用完' };
    }
    
    return { allowed: true, reason: '免费额度充足' };
  }

  async recordTavilyCall() {
    const today = new Date().toISOString().split('T')[0];
    const todayCalls = this.tavilyTodayCalls.get(today) || 0;
    this.tavilyTodayCalls.set(today, todayCalls + 1);
    return todayCalls + 1;
  }

  async completeSearch(query, userTier = 'free', options = {}) {
    this.stats.totalRequests++;
    
    const { source, reason } = this.determineSearchSource(userTier, query);
    
    let primaryResult;
    let fallbackResult = null;
    let usedSource = source;
    let fallbackUsed = false;

    if (source === 'tavily') {
      const canUse = await this.canUseTavily();
      if (!canUse.allowed) {
        console.log(`[Search] Tavily${canUse.reason}，降级到百度`);
        usedSource = 'baidu';
        fallbackUsed = true;
        reason = 'Tavily额度用尽，降级到百度';
      }
    }

    if (usedSource === 'tavily') {
      try {
        this.stats.tavilyRequests++;
        console.log(`[Search] 使用Tavily搜索: ${query}`);
        
        primaryResult = await tavilyService.search(query, {
          max_results: options.max_results || 8,
          search_depth: 'advanced',
          include_images: true
        });

        if (primaryResult.success && primaryResult.data && primaryResult.data.results.length > 0) {
          await this.recordTavilyCall();
          return this.formatResult(primaryResult, 'tavily', reason);
        } else {
          throw new Error('Tavily返回无效结果');
        }
      } catch (error) {
        console.error(`[Search] Tavily失败(${error.message})，降级到百度`);
        this.stats.tavilyFallbackRequests++;
        fallbackUsed = true;
        usedSource = 'baidu';
      }
    }

    try {
      if (!fallbackUsed) {
        this.stats.baiduRequests++;
      }
      
      console.log(`[Search] 使用百度搜索: ${query}`);
      
      const imageResult = await baiduSearch.imageSearch(query, { max_results: options.max_results || 4 });
      const webResult = await baiduSearch.search(query, { max_results: options.max_results || 4 });

      const combinedResults = [];
      const seenUrls = new Set();

      if (webResult.success && webResult.data && webResult.data.results) {
        for (const item of webResult.data.results) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            combinedResults.push(item);
          }
        }
      }

      if (imageResult.success && imageResult.data && imageResult.data.results) {
        for (const item of imageResult.data.results) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            combinedResults.push(item);
          }
        }
      }

      const images = combinedResults.filter(r => r.imageUrl && r.imageUrl.startsWith('http')).map(r => {
        const cleanUrl = r.imageUrl.trim().replace(/^[`'"]+|[`'"]+$/g, '');
        return cleanUrl;
      });

      return {
        success: true,
        searched: true,
        reason: fallbackUsed ? 'Tavily失败，已降级到百度' : reason,
        source: usedSource,
        result: {
          answer: '',
          results: combinedResults,
          images: images
        },
        context: this.buildContext(combinedResults),
        images: images
      };
    } catch (error) {
      this.stats.errors++;
      console.error(`[Search] 搜索失败: ${error.message}`);
      return {
        success: false,
        searched: false,
        reason: '搜索服务暂时不可用',
        error: error.message
      };
    }
  }

  formatResult(tavilyResult, source, reason) {
    if (!tavilyResult.success || !tavilyResult.data) {
      return {
        success: false,
        searched: false,
        reason: reason,
        error: tavilyResult.error
      };
    }

    const images = tavilyResult.data.results
      .filter(r => r.imageUrl && r.imageUrl.startsWith('http'))
      .map(r => r.imageUrl);

    return {
      success: true,
      searched: true,
      reason: reason,
      source: source,
      result: {
        answer: tavilyResult.data.answer,
        results: tavilyResult.data.results,
        images: images
      },
      context: this.buildContext(tavilyResult.data.results),
      images: images
    };
  }

  buildContext(results) {
    if (!results || results.length === 0) {
      return '';
    }

    const summaries = results.slice(0, 5).map((item, index) => {
      const dateStr = item.publishedDate ? ` (${item.publishedDate})` : '';
      return `${index + 1}. [${item.title || '未命名'}${dateStr}] ${(item.content || '').slice(0, 150)}...\n来源: ${item.url}`;
    });

    return `联网搜索结果（共${results.length}条）:\n\n${summaries.join('\n\n')}`;
  }

  getStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayTavilyCalls = this.tavilyTodayCalls.get(today) || 0;
    const remainingQuota = this.maxTavilyCallsPerDay - todayTavilyCalls;
    
    return {
      ...this.stats,
      todayTavilyCalls: todayTavilyCalls,
      remainingTavilyQuota: remainingQuota,
      maxTavilyQuota: this.maxTavilyCallsPerDay,
      quotaUsagePercent: ((todayTavilyCalls / this.maxTavilyCallsPerDay) * 100).toFixed(2) + '%'
    };
  }

  resetStats() {
    this.stats = {
      totalRequests: 0,
      baiduRequests: 0,
      tavilyRequests: 0,
      baiduFallbackRequests: 0,
      tavilyFallbackRequests: 0,
      errors: 0,
      lastResetTime: Date.now()
    };
    this.tavilyTodayCalls.clear();
  }
}

module.exports = new SearchDispatcher();