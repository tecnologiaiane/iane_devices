import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { authService } from '../services/authService';
import { User as UserType } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-navy-950 font-sans select-none">
      {/* 1. Imagem de fundo corporativa logo.jpg com desfoque */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-105 filter blur-sm opacity-25 transition-all duration-700"
        style={{
          backgroundImage: "url('/logo.jpg')",
        }}
        aria-hidden="true"
      />

      {/* 2. Degradê da marca: marinho → azul IANE */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-iane-700" />

      {/* 3. Card de Login Limpo nas cores da empresa */}
      <div className="relative z-10 w-full max-w-[390px] bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-7 sm:p-8 border border-iane-100/60 transition-all">
        {/* Logo Superior Central: logo.png */}
        <div className="flex flex-col items-center mb-6">
          <img
            src="/logo.png"
            alt="IANE - Gestão de Dispositivos"
            className="w-40 h-auto max-h-20 object-contain drop-shadow-sm mb-2"
          />
          <h1 className="text-xs font-bold tracking-wider uppercase text-iane-700 text-center">
            Gestão de Dispositivos
          </h1>
        </div>

        {/* Alerta de erro de autenticação */}
        {authError && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="font-medium">{authError}</span>
          </div>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Campo Login */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-semibold text-ink-800 mb-1.5"
            >
              Login
            </label>
            <div className="relative">
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (usernameError && e.target.value.trim()) {
                    setUsernameError(null);
                  }
                }}
                placeholder="Digite seu Login"
                className={`w-full px-3.5 py-2.5 bg-ink-50 hover:bg-white focus:bg-white border rounded-lg text-sm text-ink-800 placeholder-ink-400 outline-none transition-all ${
                  usernameError
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                    : 'border-ink-300 focus:border-iane-600 focus:ring-2 focus:ring-iane-600/20'
                }`}
              />
            </div>
            {usernameError && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {usernameError}
              </p>
            )}
          </div>

          {/* Campo Senha */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-ink-800 mb-1.5"
            >
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError && e.target.value.trim()) {
                    setPasswordError(null);
                  }
                }}
                placeholder="Digite sua Senha"
                className={`w-full pl-3.5 pr-10 py-2.5 bg-ink-50 hover:bg-white focus:bg-white border rounded-lg text-sm text-ink-800 placeholder-ink-400 outline-none transition-all ${
                  passwordError
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                    : 'border-ink-300 focus:border-iane-600 focus:ring-2 focus:ring-iane-600/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-400 hover:text-iane-700 transition-colors cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {passwordError}
              </p>
            )}
          </div>

          {/* Botão de Login nas cores corporativas azuis da IANE */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 bg-iane-600 hover:bg-iane-700 active:bg-iane-800 active:scale-[0.99] text-white font-semibold text-sm tracking-wide rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-sun-500 focus:ring-offset-2 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>
      </div>

      {/* Rodapé institucional discreto */}
      <footer className="absolute bottom-3 text-center text-[11px] text-white/50 tracking-wider">
        IANE Indústria e Comércio © {new Date().getFullYear()} — Todos os direitos reservados
      </footer>
    </div>
  );
};
