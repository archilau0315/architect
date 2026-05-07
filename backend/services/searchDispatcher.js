const baiduSearch = require('./baiduSearchService');
const tavilyService = require('./tavilyService');
const { logger, LogLevel } = require('./loggerService');

const isProduction = process.env.NODE_ENV === 'production';
const SEARCH_LOG_LEVEL = isProduction
  ? (LogLevel[process.env.SEARCH_LOG_LEVEL?.toUpperCase()] || LogLevel.WARN)
  : LogLevel.INFO;

const searchLog = {
  debug: (message, data) => {
    if (SEARCH_LOG_LEVEL <= LogLevel.DEBUG) {
      logger.debug(`[Search] ${message}`, data);
    }
  },
  info: (message, data) => {
    if (SEARCH_LOG_LEVEL <= LogLevel.INFO) {
      logger.info(`[Search] ${message}`, data);
    }
  },
  warn: (message, data) => {
    if (SEARCH_LOG_LEVEL <= LogLevel.WARN) {
      logger.warn(`[Search] ${message}`, data);
    }
  },
  error: (message, data) => {
    if (SEARCH_LOG_LEVEL <= LogLevel.ERROR) {
      logger.error(`[Search] ${message}`, data);
    }
  }
};

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

const ARCHITECTURE_KEYWORDS = [
  '建筑', '设计', '外观', '结构', '现代', '流线型', '公共建筑',
  '博物馆', '剧院', '体育馆', '住宅', '商业', '办公', '文化中心',
  '广场', '空间', '景观', '城市', '地标', '天际线', '外立面',
  'architecture', 'building', 'design', 'urban', 'plaza', 'landscape'
];

const ARCHITECTS = [
  '扎哈·哈迪德', 'Zaha Hadid',
  '贝聿铭', 'I.M. Pei',
  '隈研吾', 'Kengo Kuma',
  '弗兰克·盖里', 'Frank Gehry',
  '托马斯·赫斯维克', 'Thomas Heatherwick',
  '诺曼·福斯特', 'Norman Foster',
  '圣地亚哥·卡拉特拉瓦', 'Santiago Calatrava',
  '安藤忠雄', 'Tadao Ando',
  '赫尔佐格', '德梅隆', 'Herzog', 'de Meuron',
  '库哈斯', 'Rem Koolhaas',
  '莫舍·萨夫迪', 'Moshe Safdie'
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

  detectDomain(query) {
    const lowerQuery = query.toLowerCase();

    if (ARCHITECTURE_KEYWORDS.some(kw => lowerQuery.includes(kw.toLowerCase()))) {
      return 'architecture';
    }

    const artKeywords = ['艺术', 'art', 'painting', 'sculpture', 'artist', 'gallery'];
    if (artKeywords.some(kw => lowerQuery.includes(kw.toLowerCase()))) {
      return 'art';
    }

    return 'general';
  }

  extractArchitects(query) {
    const found = [];
    ARCHITECTS.forEach(architect => {
      if (query.includes(architect)) {
        found.push(architect);
      }
    });
    return found;
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

    searchLog.debug('原始查询', { query });

    let enhancedQuery = query;
    const domain = this.detectDomain(query);
    const architects = this.extractArchitects(query);

    searchLog.debug('识别领域和建筑师', { domain, architects });

    if (domain === 'architecture') {
      const architectureTerms = [
        '建筑设计 实际照片',
        '建筑外观 效果图',
        '现代建筑 外观',
        '建筑摄影 实景',
        'architectural photography',
        'building exterior photo',
        'modern architecture design',
        'contemporary building'
      ];
      const randomPrefix = architectureTerms[Math.floor(Math.random() * architectureTerms.length)];

      let architectQuery = '';
      if (architects.length > 0) {
        architectQuery = ` ${architects.join(' ')}`;
      }

      enhancedQuery = `${randomPrefix}${architectQuery} ${query} -图纸 -技术图 -CAD -平面图 -剖面图 -草图 -代码 -编程 -数据 -json -xml`;
    } else if (domain === 'art') {
      enhancedQuery = `艺术作品 绘画 实际照片 ${query} -图纸 -草图 -代码`;
    } else {
      if (!enhancedQuery.includes('实际照片') && !enhancedQuery.includes('actual photo')) {
        enhancedQuery += ' 实际照片';
      }
    }

    searchLog.debug('增强查询', { enhancedQuery });

    const timestamp = Date.now();
    const { source, reason } = this.determineSearchSource(userTier, enhancedQuery);

    let primaryResult;
    let fallbackResult = null;
    let usedSource = source;
    let fallbackUsed = false;

    if (source === 'tavily') {
      const canUse = await this.canUseTavily();
      if (!canUse.allowed) {
        searchLog.warn('Tavily额度不足，降级百度', { reason: canUse.reason });
        usedSource = 'baidu';
        fallbackUsed = true;
        reason = 'Tavily额度用尽，降级到百度';
      }
    }

    if (usedSource === 'tavily') {
      try {
        this.stats.tavilyRequests++;
        searchLog.info('使用Tavily搜索');

        primaryResult = await tavilyService.search(enhancedQuery, {
          max_results: options.max_results || 8,
          search_depth: 'advanced',
          include_images: true,
          timestamp: timestamp
        });

        if (primaryResult.success && primaryResult.data && primaryResult.data.results.length > 0) {
          await this.recordTavilyCall();
          return this.formatResult(primaryResult, 'tavily', reason);
        } else {
          throw new Error('Tavily返回无效结果');
        }
      } catch (error) {
        searchLog.error('Tavily搜索失败，降级百度', { error: error.message });
        this.stats.tavilyFallbackRequests++;
        fallbackUsed = true;
        usedSource = 'baidu';
      }
    }

    try {
      if (!fallbackUsed) {
        this.stats.baiduRequests++;
      }

      searchLog.info('使用百度图片搜索');

      const imageResult = await baiduSearch.imageSearch(enhancedQuery, {
        max_results: options.max_results || 8
      });

      const images = [];
      const invalidExtensions = ['.dwg', '.dxf', '.cad', '.svg', '.pdf', '.json', '.xml', '.txt'];

      if (imageResult.success && imageResult.data && imageResult.data.results) {
        searchLog.debug('原始图片数量', { count: imageResult.data.results.length });

        for (const item of imageResult.data.results) {
          if (item.imageUrl && item.imageUrl.startsWith('http')) {
            const cleanUrl = item.imageUrl.trim().replace(/^[`'"]+|[`'"]+$/g, '');

            const hasInvalidExt = invalidExtensions.some(ext => cleanUrl.toLowerCase().includes(ext));

            const isTechDoc = cleanUrl.toLowerCase().includes('cad') ||
                             cleanUrl.toLowerCase().includes('technical') ||
                             cleanUrl.toLowerCase().includes('blueprint') ||
                             cleanUrl.toLowerCase().includes('drawing') ||
                             cleanUrl.toLowerCase().includes('sketch') ||
                             cleanUrl.toLowerCase().includes('code') ||
                             cleanUrl.toLowerCase().includes('python') ||
                             cleanUrl.toLowerCase().includes('github');

            if (!hasInvalidExt && !isTechDoc) {
              images.push(cleanUrl);
            } else {
              searchLog.debug('过滤无效图片', { reason: hasInvalidExt ? '无效扩展名' : '技术图纸/代码' });
            }
          }
        }
      }

      searchLog.info('过滤后图片数量', { count: images.length });

      if (images.length === 0) {
        searchLog.warn('过滤后无图片，尝试备用搜索');
        const backupQueries = [
          '现代建筑设计 外观照片',
          '建筑效果图 实景',
          '城市地标建筑 图片',
          'architecture building exterior photo',
          'modern architecture photography'
        ];

        for (const backupQuery of backupQueries) {
          const backupResult = await baiduSearch.imageSearch(backupQuery, { max_results: 4 });
          if (backupResult.success && backupResult.data && backupResult.data.results) {
            for (const item of backupResult.data.results) {
              if (item.imageUrl && item.imageUrl.startsWith('http')) {
                const cleanUrl = item.imageUrl.trim();
                const hasInvalidExt = invalidExtensions.some(ext => cleanUrl.toLowerCase().includes(ext));
                if (!hasInvalidExt) {
                  images.push(cleanUrl);
                }
              }
            }
          }
          if (images.length >= 4) break;
        }
      }

      searchLog.info('搜索完成', { finalImageCount: images.length, source: usedSource });

      return {
        success: true,
        searched: true,
        reason: fallbackUsed ? 'Tavily失败，已降级到百度' : reason,
        source: usedSource,
        result: {
          answer: '',
          results: [],
          images: images
        },
        context: `搜索到 ${images.length} 张相关图片`,
        images: images
      };
    } catch (error) {
      this.stats.errors++;
      searchLog.error('搜索失败', { error: error.message });
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
