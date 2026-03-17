/**
 * 首席图像架构师 - 路由服务
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

import { api } from './apiService';

interface ModelInfo {
  model_id: string;
  model_name: string;
  model_type: 'text' | 'image' | 'video' | 'multimodal';
  provider: string;
  description?: string;
  min_tier: string;
  supports_vision: boolean;
}

interface ChannelInfo {
  channel_id: string;
  channel_name: string;
  provider: string;
  status: string;
  success_rate: number;
  avg_latency_ms: number;
}

interface RoutingSelection {
  model: ModelInfo;
  channel?: {
    channel_id: string;
    channel_name: string;
    base_url: string;
  };
  strategy: string;
  estimated_cost: number;
  quota?: any;
  warning?: string;
}

class RoutingService {
  async selectModel(
    feature: string,
    strategy?: string,
    params?: Record<string, any>
  ): Promise<{ success: boolean; data?: RoutingSelection }> {
    return api.post('/api/routing/select', { feature, strategy, params });
  }

  async getAvailableModels(): Promise<{
    success: boolean;
    data?: { models: ModelInfo[]; user_tier: string };
  }> {
    return api.get('/api/routing/models');
  }

  async getChannels(): Promise<{
    success: boolean;
    data?: { channels: ChannelInfo[] };
  }> {
    return api.get('/api/routing/channels');
  }

  async checkQuota(
    feature: string,
    params?: Record<string, any>
  ): Promise<{
    success: boolean;
    data?: {
      allowed: boolean;
      reason?: string;
      quota?: any;
      estimated_cost: number;
    };
  }> {
    return api.post('/api/routing/check-quota', { feature, params });
  }

  async preDeduct(
    amount: number,
    feature: string,
    requestId?: string
  ): Promise<{
    success: boolean;
    message?: string;
    data?: { deducted: number; request_id: string };
  }> {
    return api.post('/api/routing/pre-deduct', {
      amount,
      feature,
      request_id: requestId,
    });
  }

  async refund(
    amount: number,
    requestId: string,
    reason?: string
  ): Promise<{ success: boolean; message?: string; data?: any }> {
    return api.post('/api/routing/refund', {
      amount,
      request_id: requestId,
      reason,
    });
  }

  async logUsage(data: {
    request_id: string;
    feature: string;
    model_id: string;
    channel_id: string;
    routing_strategy?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    points_cost?: number;
    actual_cost?: number;
    image_count?: number;
    video_duration?: number;
    resolution?: string;
    status?: string;
    error_message?: string;
    latency_ms?: number;
  }): Promise<{ success: boolean; data?: { log_id: number } }> {
    return api.post('/api/routing/log-usage', data);
  }

  async checkCache(
    feature: string,
    params: Record<string, any>
  ): Promise<{
    success: boolean;
    data?: {
      cache_hit: boolean;
      result?: any;
      model_id?: string;
      created_at?: string;
      request_hash?: string;
    };
  }> {
    return api.post('/api/routing/check-cache', { feature, params });
  }

  async setCache(
    feature: string,
    params: Record<string, any>,
    value: any,
    modelId: string
  ): Promise<{ success: boolean; message?: string }> {
    return api.post('/api/routing/set-cache', {
      feature,
      params,
      value,
      model_id: modelId,
    });
  }

  async getBudgetStatus(): Promise<{
    success: boolean;
    data?: {
      daily: { cost: number; limit: number; exceeded: boolean; percentage: number };
      monthly: { cost: number; limit: number; exceeded: boolean; percentage: number };
      circuit_breaker: boolean;
    };
  }> {
    return api.get('/api/routing/budget');
  }

  async getCostReport(period: 'today' | 'week' | 'month' | 'all' = 'today'): Promise<{
    success: boolean;
    data?: {
      period: string;
      by_feature: any[];
      by_model: any[];
      by_channel: any[];
    };
  }> {
    return api.get('/api/routing/cost-report', { period });
  }
}

export const routingService = new RoutingService();
export type { ModelInfo, ChannelInfo, RoutingSelection };
