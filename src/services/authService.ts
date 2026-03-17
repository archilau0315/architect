/**
 * 首席图像架构师 - 认证服务
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

import { api } from './apiService';

interface User {
  id: number;
  email: string;
  phone?: string;
  nickname?: string;
  avatar_url?: string;
  user_tier: 'free' | 'basic' | 'pro' | 'plus';
  tier_expires_at?: string;
  daily_points: number;
  purchased_points: number;
  total_consumed_points: number;
  status: number;
  email_verified: boolean;
  phone_verified: boolean;
  last_login_at?: string;
  created_at: string;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    tokens: AuthTokens;
  };
}

class AuthService {
  private currentUser: User | null = null;

  async register(data: {
    email: string;
    password: string;
    nickname?: string;
    phone?: string;
  }): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/register', data);
    if (response.success && response.data?.tokens) {
      api.setTokens(response.data.tokens.access_token, response.data.tokens.refresh_token);
      this.currentUser = response.data.user;
    }
    return response;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/login', { email, password });
    if (response.success && response.data?.tokens) {
      api.setTokens(response.data.tokens.access_token, response.data.tokens.refresh_token);
      this.currentUser = response.data.user;
    }
    return response;
  }

  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
    api.clearTokens();
    this.currentUser = null;
  }

  async refresh(): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/refresh', {
      refresh_token: api.getTokens().refreshToken,
    });
    if (response.success && response.data?.tokens) {
      api.setTokens(response.data.tokens.access_token, response.data.tokens.refresh_token);
    }
    return response;
  }

  async me(): Promise<{ success: boolean; data?: User }> {
    const response = await api.get<{ success: boolean; data?: User }>('/api/auth/me');
    if (response.success && response.data) {
      this.currentUser = response.data;
    }
    return response;
  }

  async updateProfile(data: {
    nickname?: string;
    avatar_url?: string;
    phone?: string;
  }): Promise<{ success: boolean; data?: User }> {
    const response = await api.put<{ success: boolean; data?: User }>('/api/auth/profile', data);
    if (response.success && response.data) {
      this.currentUser = response.data;
    }
    return response;
  }

  async changePassword(data: {
    old_password: string;
    new_password: string;
  }): Promise<{ success: boolean; message?: string }> {
    return api.post('/api/auth/change-password', data);
  }

  async sendVerificationCode(email?: string, phone?: string): Promise<{
    success: boolean;
    message?: string;
    data?: { expires_in: number; type: string };
  }> {
    return api.post('/api/auth/send-code', { email, phone });
  }

  async verifyCode(
    code: string,
    email?: string,
    phone?: string
  ): Promise<{ success: boolean; message?: string }> {
    return api.post('/api/auth/verify-code', { email, phone, code });
  }

  async resetPassword(
    email: string,
    code: string,
    new_password: string
  ): Promise<{ success: boolean; message?: string }> {
    return api.post('/api/auth/reset-password', { email, code, new_password });
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

export const authService = new AuthService();
export type { User, AuthTokens, AuthResponse };
