import { User, LoginCredentials } from '../types';
import { apiClient } from './apiClient';

const AUTH_USER_KEY = 'iane_auth_current_user_v2';
const AUTH_TOKEN_KEY = 'iane_auth_token_v2';

type AuthListener = (user: User | null) => void;

class AuthService {
  private listeners: Set<AuthListener> = new Set();

  public getCurrentUser(): User | null {
    try {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  public getToken(): string | null {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(user: User | null): void {
    this.listeners.forEach((listener) => {
      try {
        listener(user);
      } catch (e) {
        console.error('Error in auth listener:', e);
      }
    });
  }

  public async login(credentials: LoginCredentials): Promise<{ success: boolean; message?: string; user?: User }> {
    const trimmedUser = credentials.username.trim().toLowerCase();
    const trimmedPass = credentials.password.trim();

    if (!trimmedUser || !trimmedPass) {
      return { success: false, message: 'Informe o usuário e a senha.' };
    }

    try {
      const res = await apiClient.post<{ user: any; token: string }>('/api/auth/login', {
        username: trimmedUser,
        password: trimmedPass,
      });

      if (res.success && res.data && res.data.user) {
        const u = res.data.user;
        const user: User = {
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          permissions: u.permissions || ['all'],
          active: u.active !== false,
        };

        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        if (res.data.token) {
          localStorage.setItem(AUTH_TOKEN_KEY, res.data.token);
        }
        this.notify(user);
        return { success: true, user };
      } else {
        return {
          success: false,
          message: res.message || 'Credenciais inválidas. Verifique o usuário e a senha informados.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Não foi possível conectar ao servidor. Verifique se o backend está em execução.',
      };
    }
  }

  public logout(): void {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    this.notify(null);
  }

  public hasPermission(permission: string, userOverride?: User | null): boolean {
    const user = userOverride !== undefined ? userOverride : this.getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!user.permissions || user.permissions.length === 0) return false;
    if (user.permissions.includes('all')) return true;
    return user.permissions.includes(permission);
  }

  public canManageUsers(userOverride?: User | null): boolean {
    const user = userOverride !== undefined ? userOverride : this.getCurrentUser();
    if (!user) return false;
    return user.role === 'admin' || this.hasPermission('manage_users', user);
  }

  public isAdmin(userOverride?: User | null): boolean {
    const user = userOverride !== undefined ? userOverride : this.getCurrentUser();
    return user?.role === 'admin';
  }
}

export const authService = new AuthService();
