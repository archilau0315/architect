/**
 * 首席图像架构师 - 统一 API 客户端
 *
 * @package KbitArchitect
 * @version 1.0.0
 */

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: number;
}

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private retries: number;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
    this.timeout = 30000; // 30秒
    this.retries = 3;
  }

  private getAuthToken(): string | null {
    try {
      const session = localStorage.getItem('architect-invite-session');
      if (session) {
        const sessionData = JSON.parse(session);
        return sessionData.token || null;
      }
    } catch (error) {
      console.error('[API客户端] 获取token失败:', error);
    }
    return null;
  }

  private async request<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.timeout,
      retries = this.retries,
    } = config;

    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getAuthToken();

    const requestHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...headers,
    };

    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: data.error || `HTTP ${response.status}`,
            code: response.status,
          };
        }

        return data;
      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError') {
          console.warn(`[API客户端] 请求超时: ${endpoint}`);
        } else {
          console.warn(`[API客户端] 请求失败 (尝试 ${attempt + 1}/${retries + 1}):`, error);
        }

        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || '请求失败',
      code: 500,
    };
  }

  // GET 请求
  async get<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  // POST 请求
  async post<T = any>(endpoint: string, body?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body });
  }

  // PUT 请求
  async put<T = any>(endpoint: string, body?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body });
  }

  // DELETE 请求
  async delete<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // PATCH 请求
  async patch<T = any>(endpoint: string, body?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body });
  }

  // 设置认证token
  setAuthToken(token: string): void {
    try {
      const session = localStorage.getItem('architect-invite-session');
      if (session) {
        const sessionData = JSON.parse(session);
        sessionData.token = token;
        localStorage.setItem('architect-invite-session', JSON.stringify(sessionData));
      }
    } catch (error) {
      console.error('[API客户端] 设置token失败:', error);
    }
  }

  // 清除认证token
  clearAuthToken(): void {
    try {
      localStorage.removeItem('architect-invite-session');
    } catch (error) {
      console.error('[API客户端] 清除token失败:', error);
    }
  }

  // 设置基础URL
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  // 设置默认超时时间
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  // 设置重试次数
  setRetries(retries: number): void {
    this.retries = retries;
  }
}

// 导出单例实例
export const apiClient = new ApiClient();

// 导出类型
export type { ApiResponse, RequestConfig };

// 导出类
export default ApiClient;
