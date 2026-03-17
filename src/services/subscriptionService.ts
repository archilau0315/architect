/**
 * 首席图像架构师 - 订阅服务
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

import { api } from './apiService';

interface TierConfig {
  tier_code: 'free' | 'basic' | 'pro' | 'plus';
  tier_name: string;
  daily_points: number;
  max_resolution: string;
  daily_image_limit: number;
  daily_video_limit: number;
  daily_chat_limit: number;
  monthly_token_quota: number;
  watermark_free_downloads: number;
  features: Record<string, boolean>;
  price_monthly: number;
  price_quarterly: number;
  price_yearly: number;
}

interface Subscription {
  id: number;
  user_id: number;
  tier_code: string;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  currency: string;
  status: 'pending' | 'active' | 'cancelled' | 'expired' | 'refunded';
  payment_method?: string;
  payment_transaction_id?: string;
  started_at: string;
  expires_at: string;
  cancelled_at?: string;
  auto_renew: boolean;
  created_at: string;
}

class SubscriptionService {
  async getPlans(): Promise<{ success: boolean; data?: { plans: TierConfig[] } }> {
    return api.get('/api/subscription/plans');
  }

  async subscribe(data: {
    tier: 'basic' | 'pro' | 'plus';
    billing_cycle: 'monthly' | 'quarterly' | 'yearly';
    payment_method?: string;
  }): Promise<{ success: boolean; message?: string; data?: any }> {
    return api.post('/api/subscription/subscribe', data);
  }

  async activateLicense(
    license_key: string
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    return api.post('/api/subscription/activate-license', { license_key });
  }

  async getCurrentSubscription(): Promise<{
    success: boolean;
    data?: { subscription: Subscription | null };
  }> {
    return api.get('/api/subscription/current');
  }

  async getHistory(limit: number = 10): Promise<{
    success: boolean;
    data?: { history: Subscription[] };
  }> {
    return api.get('/api/subscription/history', { limit });
  }

  async cancel(subscription_id: number): Promise<{
    success: boolean;
    message?: string;
  }> {
    return api.post('/api/subscription/cancel', { subscription_id });
  }

  async checkUpgrade(): Promise<{
    success: boolean;
    data?: {
      current_tier: string;
      available_upgrades: TierConfig[];
    };
  }> {
    return api.get('/api/subscription/check-upgrade');
  }
}

export const subscriptionService = new SubscriptionService();
export type { TierConfig, Subscription };
