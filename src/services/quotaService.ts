/**
 * 首席图像架构师 - 配额服务
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

import { api } from './apiService';

interface QuotaInfo {
  user: {
    id: number;
    nickname?: string;
    tier: string;
    tier_name: string;
    tier_expires_at?: string;
  };
  points: {
    daily: number;
    purchased: number;
    total: number;
    total_consumed: number;
  };
  limits: {
    daily_image: { limit: number; used: number };
    daily_video: { limit: number; used: number };
    max_resolution: string;
    watermark_free_downloads: number;
  };
  features: Record<string, boolean>;
}

interface UsageStats {
  summary: {
    total_requests: number;
    successful_requests: number;
    total_points_spent: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
  };
  by_feature: Array<{
    feature: string;
    count: number;
    points: number;
    tokens: number;
  }>;
}

class QuotaService {
  async getQuota(): Promise<{ success: boolean; data?: QuotaInfo }> {
    return api.get('/api/user/quota');
  }

  async getUsageStats(period: 'today' | 'week' | 'month' = 'today'): Promise<{
    success: boolean;
    data?: UsageStats;
  }> {
    return api.get('/api/user/usage', { period });
  }

  async getTransactionHistory(page: number = 1, limit: number = 20): Promise<{
    success: boolean;
    data?: {
      transactions: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
      };
    };
  }> {
    return api.get('/api/user/transactions', { page, limit });
  }

  async purchasePoints(amount: number, paymentMethod: string = 'alipay'): Promise<{
    success: boolean;
    message?: string;
    data?: {
      transaction_id: string;
      amount: number;
      points: number;
      new_balance: number;
    };
  }> {
    return api.post('/api/user/purchase-points', {
      amount,
      payment_method: paymentMethod,
    });
  }
}

export const quotaService = new QuotaService();
export type { QuotaInfo, UsageStats };
