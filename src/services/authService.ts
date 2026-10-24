import { User, LoginCredentials } from '../types';

const AUTH_USER_KEY = 'iane_auth_current_user_v1';
const AUTH_TOKEN_KEY = 'iane_auth_token_v1';

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

    // 1. Tenta autenticação via Backend PostgreSQL (/api/auth/login)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, password: trimmedPass }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
          if (data.token) localStorage.setItem(AUTH_TOKEN_KEY, data.token);
          this.notify(data.user);
          return { success: true, user: data.user };
        } else if (data.message) {
          // Se o backend respondeu com erro explícito de credenciais
          return { success: false, message: data.message };
        }
      }
    } catch {
      // Falha de rede ou backend indisponível; segue para validação local de fallback
    }

    // 2. Validação local padrão (admin / iane)
    if (
      (trimmedUser === 'admin' && (trimmedPass === 'admin' || trimmedPass === 'admin123' || trimmedPass === 'iane123')) ||
      (trimmedUser === 'iane' && (trimmedPass === 'iane' || trimmedPass === 'iane123' || trimmedPass === 'admin')) ||
      (trimmedUser === 'tecnologia@iane.ind.br' && (trimmedPass === 'admin' || trimmedPass === 'iane123'))
    ) {
      const user: User = {
        id: 'user-admin',
        username: trimmedUser,
        fullName: trimmedUser === 'iane' ? 'Gestão IANE' : 'Administrador IANE',
        email: 'tecnologia@iane.ind.br',
        role: 'admin',
      };

      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      localStorage.setItem(AUTH_TOKEN_KEY, 'iane_local_session_token');
      this.notify(user);
      return { success: true, user };
    }

    return {
      success: false,
      message: 'Usuário ou senha inválidos. Tente "admin" e senha "admin".',
    };
  }

  public logout(): void {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    this.notify(null);
  }
}

export const authService = new AuthService();
