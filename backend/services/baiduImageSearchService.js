const axios = require('axios');

const BAIDU_API_KEY = process.env.BAIDU_API_KEY;
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY;

if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
  console.warn('[BaiduImage] 警告：百度API密钥未配置，相似图片搜索功能将不可用');
}
const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_IMAGE_SEARCH_URL = 'https://aip.baidubce.com/rest/2.0/image-classify/v1/realtime_search/similar';

class BaiduImageSearchService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.callCount = 0;
    this.totalRequests = 0;
    this.errorCount = 0;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(BAIDU_TOKEN_URL, null, {
        params: {
          grant_type: 'client_credentials',
          client_id: BAIDU_API_KEY,
          client_secret: BAIDU_SECRET_KEY
        },
        timeout: 10000
      });

      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;
        console.log('[BaiduImage] Access token obtained successfully');
        return this.accessToken;
      }

      throw new Error('Failed to get access token: ' + JSON.stringify(response.data));
    } catch (error) {
      console.error('[BaiduImage] Failed to get access token:', error.message);
      throw error;
    }
  }

  convertToBase64(dataUrl) {
    if (!dataUrl) return null;

    if (dataUrl.startsWith('data:image')) {
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        console.error('[BaiduImage] Invalid base64 data URL format');
        return null;
      }
      return base64;
    }

    if (dataUrl.length > 100) {
      return dataUrl;
    }

    return null;
  }

  async searchSimilarImage(imageBase64, options = {}) {
    if (!imageBase64) {
      return {
        success: false,
        error: '图片数据不能为空',
        data: null
      };
    }

    try {
      const maxResults = options.max_results || 8;
      const accessToken = await this.getAccessToken();

      console.log('[BaiduImage] Starting similar image search...');

      const response = await axios.post(
        `${BAIDU_IMAGE_SEARCH_URL}?access_token=${accessToken}`,
        new URLSearchParams({
          image: imageBase64,
          pn: '0',
          rn: String(maxResults)
        }),
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.callCount++;
      this.totalRequests++;
      console.log('[BaiduImage] Similar image search successful');

      const data = response.data;

      if (data.error_code) {
        console.error('[BaiduImage] API error:', data.error_code, data.error_msg);
        return {
          success: false,
          error: data.error_msg || `API错误: ${data.error_code}`,
          data: null
        };
      }

      const results = [];
      const images = [];

      console.log('[BaiduImage] API response data:', JSON.stringify(data).substring(0, 1000));

      if (data.results && Array.isArray(data.results)) {
        console.log('[BaiduImage] Results count:', data.results.length);
        
        for (const item of data.results) {
          console.log('[BaiduImage] Item keys:', Object.keys(item));
          
          const imageUrl = item.imageUrl || item.thumbURL || item.middleURL || item.largeURL || item.url;
          const title = item.title || item.brief || '相似图片';
          const url = item.url || item.fromURL || imageUrl;
          const score = parseFloat(item.score) || parseFloat(item.similarity) || 0.5;

          if (imageUrl) {
            results.push({
              title: title,
              url: url,
              content: item.content || item.brief || '',
              imageUrl: imageUrl,
              score: score,
              source: 'baidu_image'
            });

            images.push(imageUrl);
          }
        }
      } else {
        console.log('[BaiduImage] No results found or invalid format');
      }

      results.sort((a, b) => b.score - a.score);

      console.log(`[BaiduImage] Found ${results.length} similar images`);

      return {
        success: true,
        error: null,
        data: {
          answer: `找到 ${results.length} 张相似图片`,
          results: results.slice(0, maxResults),
          images: images.slice(0, maxResults)
        }
      };
    } catch (error) {
      this.errorCount++;
      console.error('[BaiduImage] Similar image search failed:', error.message);

      if (error.response) {
        console.error('[BaiduImage] Response status:', error.response.status);
        console.error('[BaiduImage] Response data:', JSON.stringify(error.response.data));
      }

      return {
        success: false,
        error: error.message || '相似图片搜索失败',
        data: null
      };
    }
  }

  getStats() {
    return {
      callCount: this.callCount,
      totalRequests: this.totalRequests,
      errorCount: this.errorCount,
      errorRate: this.totalRequests > 0 ? (this.errorCount / this.totalRequests * 100).toFixed(2) + '%' : '0%'
    };
  }
}

module.exports = new BaiduImageSearchService();