/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { User, SystemUserFormData } from '../types';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  isOffline?: boolean;
  status?: number;
}

export interface ApiNotification {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  status?: number;
  timestamp: string;
}

type ErrorListener = (notification: ApiNotification) => void;

class ApiClientService {
  public readonly instance: AxiosInstance;
  public readonly users: UserApiService;
  private errorListeners: Set<ErrorListener> = new Set();
  private isServerOnline: boolean = true;
  private statusListeners: Set<(isOnline: boolean) => void> = new Set();

  constructor() {
    const baseURL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ? import.meta.env.VITE_API_URL : '';

    this.instance = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.users = new UserApiService(this);

    this.setupInterceptors();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.setOnlineStatus(true));
      window.addEventListener('offline', () => {
        this.setOnlineStatus(false);
        this.notifyError({
          id: `net-offline-${Date.now()}`,
          type: 'warning',
          title: 'Sem Conexão com a Internet',
          message: 'Seu navegador está desconectado da rede. O sistema operará em contingência local.',
          timestamp: new Date().toLocaleTimeString('pt-BR'),
        });
      });
    }
  }

  private setupInterceptors(): void {
    // -------------------------------------------------------------------------
    // Interceptador de Requisição: Injeção automática do Token JWT
    // -------------------------------------------------------------------------
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        try {
          const token = localStorage.getItem('iane_auth_token_v2');
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (e) {
          console.warn('[ApiClient] Erro ao ler token do localStorage:', e);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // -------------------------------------------------------------------------
    // Interceptador de Resposta: Tratamento Global de Erros (401, 403, 500, Offline)
    // -------------------------------------------------------------------------
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        this.setOnlineStatus(true);
        return response;
      },
      (error: AxiosError<any>) => {
        const status = error.response?.status;
        const responseData = error.response?.data;
        const customMessage = responseData?.message || responseData?.error;

        let notification: ApiNotification | null = null;

        // 1. Backend Inacessível / Erro de Rede / Timeout
        if (!error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
          this.setOnlineStatus(false);
          const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
          notification = {
            id: `net-err-${Date.now()}`,
            type: 'error',
            title: isTimeout ? 'Tempo Limite Esgotado' : 'Servidor Indisponível',
            message: isTimeout
              ? 'O servidor demorou muito para responder (timeout). Verifique se o container backend está ativo.'
              : 'Não foi possível conectar ao servidor backend (PostgreSQL/Express). Operando em contingência local.',
            status: 0,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
          };
        }
        // 2. Erro 401: Não Autorizado / Sessão Expirada
        else if (status === 401) {
          notification = {
            id: `auth-401-${Date.now()}`,
            type: 'warning',
            title: 'Sessão Expirada',
            message: customMessage || 'Sua credencial de acesso expirou ou é inválida. Por favor, realize login novamente.',
            status: 401,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
          };
        }
        // 3. Erro 403: Acesso Proibido / Sem Permissão RBAC
        else if (status === 403) {
          notification = {
            id: `auth-403-${Date.now()}`,
            type: 'error',
            title: 'Acesso Não Permitido',
            message: customMessage || 'Você não possui permissão para executar esta operação. Contate o administrador do sistema.',
            status: 403,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
          };
        }
        // 4. Erro 500: Erro Interno no Servidor / Falha no PostgreSQL
        else if (status && status >= 500) {
          notification = {
            id: `srv-500-${Date.now()}`,
            type: 'error',
            title: 'Erro Interno no Servidor',
            message: customMessage || 'Ocorreu uma falha interna no processamento do banco PostgreSQL. Tente novamente mais tarde.',
            status,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
          };
        }

        if (notification) {
          this.notifyError(notification);
        }

        return Promise.reject(error);
      }
    );
  }

  public notifyError(notification: ApiNotification): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (e) {
        console.error('[ApiClient] Erro no listener de notificação:', e);
      }
    });

    if (typeof window !== 'undefined') {
      const event = new CustomEvent('iane:api-notification', { detail: notification });
      window.dispatchEvent(event);
    }
  }

  private setOnlineStatus(online: boolean): void {
    if (this.isServerOnline !== online) {
      this.isServerOnline = online;
      this.statusListeners.forEach((fn) => {
        try { fn(online); } catch (e) { console.error(e); }
      });
    }
  }

  public subscribeError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  public subscribeStatus(listener: (isOnline: boolean) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.isServerOnline);
    return () => this.statusListeners.delete(listener);
  }

  public isOnline(): boolean {
    return this.isServerOnline;
  }

  // ---------------------------------------------------------------------------
  // Métodos Utilitários Padronizados (Evitam try/catch repetitivo no front-end)
  // ---------------------------------------------------------------------------
  public async get<T>(url: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    try {
      const res = await this.instance.get<any>(url, { params });
      const payload = res.data;
      return {
        success: payload?.success !== false,
        data: payload?.data !== undefined ? payload.data : payload,
        message: payload?.message,
        status: res.status,
      };
    } catch (err: any) {
      return this.handleAxiosError<T>(err);
    }
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const res = await this.instance.post<any>(url, data, config);
      const payload = res.data;
      return {
        success: payload?.success !== false,
        data: payload?.data !== undefined ? payload.data : payload,
        message: payload?.message,
        status: res.status,
      };
    } catch (err: any) {
      return this.handleAxiosError<T>(err);
    }
  }

  public async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const res = await this.instance.put<any>(url, data);
      const payload = res.data;
      return {
        success: payload?.success !== false,
        data: payload?.data !== undefined ? payload.data : payload,
        message: payload?.message,
        status: res.status,
      };
    } catch (err: any) {
      return this.handleAxiosError<T>(err);
    }
  }

  public async delete<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const res = await this.instance.delete<any>(url);
      const payload = res.data;
      return {
        success: payload?.success !== false,
        data: payload?.data !== undefined ? payload.data : payload,
        message: payload?.message,
        status: res.status,
      };
    } catch (err: any) {
      return this.handleAxiosError<T>(err);
    }
  }

  /** Baixa um arquivo binário autenticado (ex.: PDF de um termo). */
  public async getBlob(url: string): Promise<ApiResponse<Blob>> {
    try {
      const res = await this.instance.get(url, { responseType: 'blob', timeout: 30000 });
      return { success: true, data: res.data as Blob, status: res.status };
    } catch (err: any) {
      const base = this.handleAxiosError<Blob>(err);
      // Em resposta binária o corpo do erro vem como Blob: tenta extrair a mensagem JSON
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);
          base.message = parsed?.message || parsed?.error || base.message;
        } catch { /* mantém a mensagem padrão */ }
      }
      return base;
    }
  }

  private handleAxiosError<T>(err: any): ApiResponse<T> {
    const isOffline = !err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED';
    const status = err.response?.status;
    const data = err.response?.data;

    return {
      success: false,
      isOffline,
      status,
      message: data?.message || data?.error || (isOffline ? 'Servidor indisponível no momento.' : err.message),
      error: data?.error || err.message,
    };
  }

  public async healthCheck(): Promise<{ isOnline: boolean; database?: string; environment?: string }> {
    try {
      const res = await this.instance.get('/api/health', { timeout: 3000 });
      if (res.data) {
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

/**
 * Serviço de Gerenciamento de Usuários e Permissões (RBAC) via API
 */
export class UserApiService {
  constructor(private client: ApiClientService) {}

  /**
   * Lista todos os operadores e administradores cadastrados no sistema
   */
  public async getUsers(): Promise<ApiResponse<User[]>> {
    return this.client.get<User[]>('/api/users');
  }

  /**
   * Obtém detalhes de um operador específico pelo ID
   */
  public async getUserById(id: string): Promise<ApiResponse<User>> {
    return this.client.get<User>(`/api/users/${id}`);
  }

  /**
   * Cadastra novo operador com senha criptografada (bcrypt) e permissões personalizadas
   */
  public async createUser(userData: SystemUserFormData): Promise<ApiResponse<User>> {
    return this.client.post<User>('/api/users', userData);
  }

  /**
   * Atualiza dados de um operador (nome, e-mail, papel, permissões ou nova senha)
   */
  public async updateUser(id: string, userData: Partial<SystemUserFormData>): Promise<ApiResponse<User>> {
    return this.client.put<User>(`/api/users/${id}`, userData);
  }

  /**
   * Atualiza granularmente a lista de permissões do operador (definido pelo Super Admin)
   */
  public async updatePermissions(id: string, permissions: string[]): Promise<ApiResponse<User>> {
    return this.client.put<User>(`/api/users/${id}`, { permissions });
  }

  /**
   * Ativa ou desativa a conta de um operador
   */
  public async toggleUserStatus(id: string, active: boolean): Promise<ApiResponse<User>> {
    return this.client.put<User>(`/api/users/${id}`, { active });
  }

  /**
   * Exclui um operador do sistema (com proteção automática para o Super Admin principal)
   */
  public async deleteUser(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.client.delete<{ message: string }>(`/api/users/${id}`);
  }
}

export const apiClient = new ApiClientService();
export const axiosInstance = apiClient.instance;
export const userApi = apiClient.users;
export default apiClient;
