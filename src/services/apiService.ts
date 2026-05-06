/**
 * 首席图像架构师 - API服务基础类
 * 
 * @package KbitArchitect
 * @version 1.0.0
 */

class APIService {
  private static instance: APIService | null = null;
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  private constructor() {
    this.baseURL = (import.meta as any).env?.VITE_API_URL || '/architect/backend';
  }

  static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('kbit_architect_access_token', accessToken);
    localStorage.setItem('kbit_architect_refresh_token', refreshToken);
  }

  getTokens(): { accessToken: string | null; refreshToken: string | null } {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('kbit_architect_access_token');
      this.refreshToken = localStorage.getItem('kbit_architect_refresh_token');
    }
    return { accessToken: this.accessToken, refreshToken: this.refreshToken };
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('kbit_architect_access_token');
    localStorage.removeItem('kbit_architect_refresh_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { accessToken, refreshToken } = this.getTokens();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 && refreshToken) {
        try {
          await this.refreshAccessToken();
          return this.request<T>(endpoint, options);
        } catch {
          this.clearTokens();
          window.location.href = '/architect/';
          throw new Error('Session expired');
        }
      }
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    return this.request<T>(`${endpoint}${queryString ? `?${queryString}` : ''}`);
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  private async refreshAccessToken(): Promise<void> {
    const { refreshToken } = this.getTokens();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Refresh failed');
    }

    this.setTokens(data.data.tokens.access_token, data.data.tokens.refresh_token);
  }
}

export const api = APIService.getInstance();
