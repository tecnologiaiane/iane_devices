import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/authService';
import { User as UserType } from '../types';
import { Alert } from '../components/alert';
import { Button } from '../components/button';
import { Field } from '../components/field';
import { Input } from '../components/input';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    let hasError = false;
    if (!username.trim()) {
      setUsernameError('Por favor, insira um usuário!');
      hasError = true;
    } else {
      setUsernameError(null);
    }

    if (!password.trim()) {
      setPasswordError('Por favor, insira sua senha!');
      hasError = true;
    } else {
      setPasswordError(null);
    }

    if (hasError) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.login({ username: username.trim(), password });
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setAuthError(res.message || 'Usuário ou senha incorretos.');
      }
    } catch {
      setAuthError('Erro ao comunicar com o servidor. Verifique a conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full select-none items-center justify-center overflow-hidden bg-brand-navy-dark font-sans">
      {/* 1. Imagem de fundo corporativa logo.jpg com desfoque */}
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center bg-no-repeat opacity-25 blur-sm transition-all duration-700"
        style={{
          backgroundImage: "url('/logo.jpg')",
        }}
        aria-hidden="true"
      />

      {/* 2. Degradê da marca: marinho → azul IANE */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-navy-dark via-brand-navy to-brand-blue" />

      {/* 3. Card de Login nas cores da empresa */}
      <div className="relative z-10 w-full max-w-[390px] rounded-lg border border-line bg-surface/95 p-7 shadow-2xl backdrop-blur-md transition-all sm:p-8">
        {/* Logo Superior Central: logo.png */}
        <div className="mb-6 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="IANE - Gestão de Dispositivos"
            className="mb-2 h-auto max-h-20 w-40 object-contain drop-shadow-sm"
          />
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-accent">
            Gestão de Dispositivos
          </p>
        </div>

        {/* Alerta de erro de autenticação */}
        {authError && (
          <Alert tone="danger" className="mb-5">
            <span className="font-medium">{authError}</span>
          </Alert>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field
            id="username"
            label="Login"
            required
            error={usernameError ?? undefined}
          >
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              invalid={Boolean(usernameError)}
              aria-describedby={usernameError ? 'username-error' : undefined}
              onChange={(e) => {
                setUsername(e.target.value);
                if (usernameError && e.target.value.trim()) {
                  setUsernameError(null);
                }
              }}
              placeholder="Digite seu Login"
            />
          </Field>

          <Field
            id="password"
            label="Senha"
            required
            error={passwordError ?? undefined}
          >
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'password-error' : undefined}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError && e.target.value.trim()) {
                    setPasswordError(null);
                  }
                }}
                placeholder="Digite sua Senha"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </Field>

          <Button type="submit" size="lg" loading={isLoading} className="mt-2 w-full">
            Login
          </Button>
        </form>
      </div>

      {/* Rodapé institucional discreto */}
      <footer className="absolute bottom-3 text-center text-[11px] tracking-wider text-white/50">
        IANE - Industria de Alimentos do Nordeste LTDA © {new Date().getFullYear()} — Todos os direitos reservados
      </footer>
    </div>
  );
}
