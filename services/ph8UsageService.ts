import gatewayConfig from '../config/gateway_config.json';

export interface Ph8UsageData {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  daily_tokens_used: number;
  monthly_tokens_used: number;
  daily_token_limit: number;
  monthly_token_limit: number;
  last_sync: number;
}

export interface UsageStatsResponse {
  quota: {
    user_id: string;
    tier: string;
    daily_tokens_used: number;
    monthly_tokens_used: number;
    daily_token_limit: number;
    monthly_token_limit: number;
    total_tokens_used: number;
    is_limited: boolean;
    limited_until: string | null;
  } | null;
  today: {
    total_tokens: number;
    request_count: number;
  };
  month: {
    total_tokens: number;
    request_count: number;
  };
  typeBreakdown: Array<{
    request_type: string;
    tokens: number;
    count: number;
  }>;
}

const PH8_USAGE_CACHE_KEY = 'architect-ph8-usage-cache-v2';
const BACKEND_URL = '/api';

export const Ph8UsageService = {
  getApiKey(): string | null {
    return (gatewayConfig.api_keys as any)?.ph8 || null;
  },

  getCachedUsage(): Ph8UsageData | null {
    try {
      const cached = localStorage.getItem(PH8_USAGE_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error('[Ph8Usage] 读取缓存失败:', e);
    }
    return null;
  },

  setCachedUsage(data: Ph8UsageData): void {
    try {
      localStorage.setItem(PH8_USAGE_CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[Ph8Usage] 保存缓存失败:', e);
    }
  },

  async fetchUsageFromBackend(userId: string): Promise<UsageStatsResponse | null> {
    if (!userId) {
      console.warn('[Ph8Usage] 缺少用户ID');
      return null;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/usage/stats/${userId}`);
      
      if (!response.ok) {
        console.warn('[Ph8Usage] 后端返回错误:', response.status);
        return null;
      }

      const data: UsageStatsResponse = await response.json();
      console.log('[Ph8Usage] 从后端获取用量数据成功:', data);
      return data;
    } catch (e: any) {
      console.error('[Ph8Usage] 从后端获取用量失败:', e.message);
      return null;
    }
  },

  async fetchUsage(): Promise<Ph8UsageData | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      console.warn('[Ph8Usage] 未配置 ph8 API Key');
      return null;
    }

    const endpoints = [
      'https://ph8.co/v1/usage',
      'https://ph8.co/v1/dashboard/usage',
      'https://ph8.co/openai/v1/usage',
      'https://ph8.co/v1/users/me'
    ];

    for (const url of endpoints) {
      try {
        console.log(`[Ph8Usage] 尝试端点: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            // Authorization 头由后端代理自动添加
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.log(`[Ph8Usage] 端点 ${url} 返回 ${response.status}`);
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.log(`[Ph8Usage] 端点 ${url} 返回非 JSON 数据`);
          continue;
        }

        const data = await response.json();
        console.log(`[Ph8Usage] 端点 ${url} 返回数据:`, data);

        const usageData = this.parseUsageResponse(data);
        if (usageData) {
          usageData.last_sync = Date.now();
          this.setCachedUsage(usageData);
          console.log('[Ph8Usage] 用量数据获取成功:', usageData);
          return usageData;
        }
      } catch (e: any) {
        console.warn(`[Ph8Usage] 端点 ${url} 请求失败:`, e.message);
      }
    }

    console.warn('[Ph8Usage] 所有端点都无法获取用量数据');
    return null;
  },

  parseUsageResponse(data: any): Ph8UsageData | null {
    if (data.total_tokens !== undefined) {
      return {
        total_tokens: data.total_tokens || 0,
        prompt_tokens: data.prompt_tokens || 0,
        completion_tokens: data.completion_tokens || 0,
        daily_tokens_used: data.daily_tokens_used || 0,
        monthly_tokens_used: data.monthly_tokens_used || 0,
        daily_token_limit: data.daily_token_limit || 10000,
        monthly_token_limit: data.monthly_token_limit || 300000,
        last_sync: Date.now()
      };
    }

    if (data.usage) {
      return {
        total_tokens: data.usage.total_tokens || 0,
        prompt_tokens: data.usage.prompt_tokens || 0,
        completion_tokens: data.usage.completion_tokens || 0,
        daily_tokens_used: data.usage.daily_tokens_used || 0,
        monthly_tokens_used: data.usage.monthly_tokens_used || 0,
        daily_token_limit: data.usage.daily_token_limit || 10000,
        monthly_token_limit: data.usage.monthly_token_limit || 300000,
        last_sync: Date.now()
      };
    }

    if (data.data) {
      return {
        total_tokens: data.data.total_tokens || 0,
        prompt_tokens: data.data.prompt_tokens || 0,
        completion_tokens: data.data.completion_tokens || 0,
        daily_tokens_used: data.data.daily_tokens_used || 0,
        monthly_tokens_used: data.data.monthly_tokens_used || 0,
        daily_token_limit: data.data.daily_token_limit || 10000,
        monthly_token_limit: data.data.monthly_token_limit || 300000,
        last_sync: Date.now()
      };
    }

    return null;
  },

  async syncWithLocal(
    onSync: (data: Ph8UsageData) => void
  ): Promise<{ success: boolean; data?: Ph8UsageData; error?: string }> {
    try {
      const usage = await this.fetchUsage();
      if (usage) {
        onSync(usage);
        return { success: true, data: usage };
      }
      return { success: false, error: '无法获取用量数据' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async checkLimit(userId: string): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
    try {
      const response = await fetch(`${BACKEND_URL}/usage/check/${userId}`);
      
      if (!response.ok) {
        return { allowed: false, reason: '检查失败' };
      }

      const data = await response.json();
      return {
        allowed: data.allowed,
        reason: data.reason,
        remaining: data.remainingDaily
      };
    } catch (e: any) {
      console.error('[Ph8Usage] 检查限流失败:', e.message);
      return { allowed: false, reason: '服务器错误' };
    }
  },

  async recordUsage(
    userId: string,
    tokens: { prompt?: number; completion?: number; total: number },
    model: string,
    requestType: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_URL}/usage/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tokens,
          model,
          requestType,
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
        })
      });

      return response.ok;
    } catch (e: any) {
      console.error('[Ph8Usage] 记录用量失败:', e.message);
      return false;
    }
  },

  formatUsageDisplay(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  }
};
