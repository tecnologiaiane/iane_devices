/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  isOffline?: boolean;
  status?: number;
}

export interface RequestConfig {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string = '';
  private defaultTimeoutMs: number = 8000;
  private isServerOnline: boolean = true;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  constructor() {
    // Escuta eventos de rede do navegador
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.setOnlineStatus(true));
      window.addEventListener('offline', () => this.setOnlineStatus(false));
    }
  }

  public subscribeStatus(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.isServerOnline);
    return () => this.listeners.delete(listener);
  }

  private setOnlineStatus(online: boolean) {
    if (this.isServerOnline !== online) {
      this.isServerOnline = online;
      this.listeners.forEach((fn) => {
        try { fn(online); } catch (e) { console.error(e); }
      });
    }
  }

  public getOnlineStatus(): boolean {
    return this.isServerOnline;
  }

  private getAuthHeader(): Record<string, string> {
    try {
      const token = localStorage.getItem('iane_auth_token_v2');
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    } catch {
      // Ignora erro em ambientes sem localStorage
    }
    return {};
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const timeout = config?.timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...(config?.headers || {}),
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.setOnlineStatus(true);

      const contentType = response.headers.get('content-type');
      let data: any = null;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text };
      }

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          message: data?.message || data?.error || `Erro HTTP ${response.status}`,
          error: data?.error,
          data: data?.data,
        };
      }

      return {
        success: data?.success !== false,
        data: data?.data !== undefined ? data.data : data,
        message: data?.message,
        status: response.status,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isAborted = err.name === 'AbortError';
      const isNetworkError = err instanceof TypeError || err.message?.includes('Failed to fetch');

      if (isAborted || isNetworkError) {
        this.setOnlineStatus(false);
      }

      console.warn(`[ApiClient] Falha na requisição ${method} ${url}:`, err.message);

      return {
        success: false,
        isOffline: true,
        message: isAborted
          ? 'Tempo limite de resposta do servidor esgotado (Timeout).'
          : 'Backend indisponível ou inacessível no momento. Operando em contingência local.',
        error: err.message,
      };
    }
  }

  public async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, 'GET', undefined, config);
  }

  public async post<T>(endpoint: string, body?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, 'POST', body, config);
  }

  public async put<T>(endpoint: string, body?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, 'PUT', body, config);
  }

  public async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, 'DELETE', undefined, config);
  }

  public async healthCheck(): Promise<{ isOnline: boolean; database?: string; environment?: string }> {
    try {
      const res = await this.get<{ status: string; database: string; environment: string }>('/api/health', {
        timeoutMs: 3000,
      });
      if (res.success && res.data) {
        this.setOnlineStatus(true);
        return {
          isOnline: true,
          database: res.data.database,
          environment: res.data.environment,
        };
      }
      this.setOnlineStatus(false);
      return { isOnline: false };
    } catch {
      this.setOnlineStatus(false);
      return { isOnline: false };
    }
  }
}

export const apiClient = new ApiClient();
