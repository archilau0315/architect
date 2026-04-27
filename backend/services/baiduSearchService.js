const axios = require('axios');

const BAIDU_API_KEY = process.env.BAIDU_API_KEY || 'SLqhNBd6CYTh9TuuOKkp6BeE';
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || '7TcgpU4CKwEuljQIDcxisdlidzQ1ah8G';

const CHINESE_KEYWORDS = [
  '中文', '国风', '中式', '中国', '国内', '本土', '传统', 
  '古典', '江南', '东方', '故宫', '长城', '四合院', '园林',
  '水墨画', '书法', '国画', '陶瓷', '丝绸', '旗袍', '汉服',
  '粤菜', '川菜', '湘菜', '鲁菜', '苏菜', '浙菜', '闽菜', '徽菜'
];

const OVERSEAS_KEYWORDS = [
  '英文', '北欧', '极简', '欧式', '日式', '赛博朋克', 
  '欧美', '国际', '海外', '西方', '现代', '抽象', '印象派',
  '哥特', '巴洛克', '洛可可', '包豪斯', '解构', '极简主义',
  '寿司', '披萨', '汉堡', '牛排', '意面', '法餐', '日料', '韩餐'
];

class BaiduSearchService {
  constructor() {
    this.callCount = 0;
    this.totalRequests = 0;
    this.errorCount = 0;
  }

  isChineseContext(query) {
    const lowerQuery = query.toLowerCase();
    return CHINESE_KEYWORDS.some(keyword => lowerQuery.includes(keyword.toLowerCase()));
  }

  isOverseasContext(query) {
    const lowerQuery = query.toLowerCase();
    return OVERSEAS_KEYWORDS.some(keyword => lowerQuery.includes(keyword.toLowerCase()));
  }

  async search(query, options = {}) {
    if (!query || query.trim().length < 2) {
      return {
        success: false,
        error: '搜索词不能为空',
        data: null
      };
    }

    try {
      const maxResults = options.max_results || 8;

      const response = await axios.get('https://www.baidu.com/s', {
        params: {
          wd: query.trim(),
          rn: maxResults,
          ie: 'utf-8'
        },
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        }
      });

      this.callCount++;
      this.totalRequests++;
      console.log('[Baidu] 网页搜索成功:', query);

      const html = response.data;
      const results = [];

      const resultRegex = /<div class="result-op c-container xpath-log[^>]*>([\s\S]*?)<\/div>/gi;
      let match;

      while ((match = resultRegex.exec(html)) !== null) {
        const itemHtml = match[1];
        
        const titleMatch = itemHtml.match(/<h\d[^>]*>(.*?)<\/h\d>/i);
        const title = titleMatch ? this.cleanHtml(titleMatch[1]) : '';
        
        const linkMatch = itemHtml.match(/<a[^>]+href=["']([^"']+)["']/i);
        const url = linkMatch ? linkMatch[1] : '';
        
        const contentMatch = itemHtml.match(/<span class="content-right_8Zs40">([\s\S]*?)<\/span>|(<span class="c-showurl">[\s\S]*?<\/span>)|(<div class="c-abstract"[^>]*>[\s\S]*?<\/div>)/i);
        let content = '';
        if (contentMatch) {
          content = this.cleanHtml(contentMatch[0]);
        }

        if (title && url) {
          results.push({
            title: title,
            url: this.fixUrl(url),
            content: content.substring(0, 200),
            imageUrl: null,
            score: 1 - results.length * 0.05,
            source: 'baidu'
          });
        }
      }

      if (results.length === 0) {
        console.log('[Baidu] 未匹配到搜索结果，尝试备用解析');
        const simpleResults = this.extractSimpleResults(html);
        results.push(...simpleResults);
      }

      return {
        success: true,
        error: null,
        data: {
          answer: '',
          results: results.slice(0, maxResults),
          images: []
        }
      };
    } catch (error) {
      this.errorCount++;
      console.error('[Baidu Search] 网页搜索失败:', error.message);
      return {
        success: false,
        error: error.message || '搜索失败',
        data: null
      };
    }
  }

  extractSimpleResults(html) {
    const results = [];
    const links = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi);
    
    if (links) {
      for (const link of links.slice(0, 10)) {
        const hrefMatch = link.match(/href=["']([^"']+)["']/);
        const textMatch = link.match(/>([^<]+)<\/a>/);
        
        if (hrefMatch && textMatch) {
          const url = hrefMatch[1];
          const text = textMatch[1];
          
          if (url.includes('baidu.com/link') || url.startsWith('http') || url.startsWith('/')) {
            results.push({
              title: this.cleanHtml(text),
              url: this.fixUrl(url),
              content: '',
              imageUrl: null,
              score: 0.5,
              source: 'baidu'
            });
          }
        }
      }
    }
    
    return results;
  }

  async imageSearch(query, options = {}) {
    if (!query || query.trim().length < 2) {
      return {
        success: false,
        error: '搜索词不能为空',
        data: null
      };
    }

    try {
      const maxResults = options.max_results || 8;

      const response = await axios.get('https://image.baidu.com/search/acjson', {
        params: {
          tn: 'resultjson_com',
          ipn: 'rj',
          word: query.trim(),
          rn: maxResults,
          pn: 0,
          ie: 'utf-8'
        },
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://image.baidu.com/',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        }
      });

      this.callCount++;
      this.totalRequests++;
      console.log('[Baidu] 图片搜索成功:', query);

      const data = response.data;
      const results = [];

      if (data && data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          if (item.thumbURL || item.middleURL || item.largeURL) {
            results.push({
              title: item.fromPageTitle || item.hoverURL || '',
              url: item.hoverURL || item.fromURL || '',
              content: '',
              imageUrl: item.middleURL || item.thumbURL || item.largeURL,
              score: 1,
              source: 'baidu'
            });
          }
        }
      }

      const images = results.filter(r => r.imageUrl).map(r => {
          const cleanUrl = r.imageUrl.trim().replace(/^[`'"]+|[`'"]+$/g, '');
          return cleanUrl;
        });

      return {
        success: true,
        error: null,
        data: {
          answer: '',
          results: results,
          images: images
        }
      };
    } catch (error) {
      this.errorCount++;
      console.error('[Baidu Image Search] 图片搜索失败:', error.message);
      return {
        success: false,
        error: error.message || '搜索失败',
        data: null
      };
    }
  }

  fixUrl(url) {
    if (!url) return '';
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return 'https://www.baidu.com' + url;
    return url;
  }

  cleanHtml(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/[\r\n\t]+/g, ' ')
      .trim();
  }

  getStats() {
    return {
      callCount: this.callCount,
      totalRequests: this.totalRequests,
      errorCount: this.errorCount,
      successRate: this.totalRequests > 0 ? ((this.totalRequests - this.errorCount) / this.totalRequests * 100).toFixed(2) + '%' : 'N/A'
    };
  }

  resetStats() {
    this.callCount = 0;
    this.errorCount = 0;
  }
}

module.exports = new BaiduSearchService();