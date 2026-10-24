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
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-slate-900 font-sans select-none">
      {/* 1. Imagem de fundo corporativa logo.jpg com desfoque */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-105 filter blur-sm opacity-35 transition-all duration-700"
        style={{
          backgroundImage: "url('/logo.jpg')",
        }}
        aria-hidden="true"
      />

      {/* 2. Camada de gradiente corporativo para contraste ideal */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#072448]/90 via-[#0b3c7b]/80 to-[#03152b]/95" />

      {/* 3. Card de Login Limpo (Clean Corporate Card) */}
      <div className="relative z-10 w-full max-w-[390px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-7 sm:p-8 border border-white/50 transition-all">
        {/* Ícone Superior Central: icone.png */}
        <div className="flex flex-col items-center mb-6">
          <img
            src="/icone.png"
            alt="IANE - Gestão de Dispositivos"
            className="w-32 h-auto max-h-20 object-contain drop-shadow-sm mb-2"
          />
          <h1 className="text-xs font-semibold tracking-wider uppercase text-slate-500 text-center">
            Gestão de Dispositivos
          </h1>
        </div>

        {/* Alerta de erro de autenticação */}
        {authError && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="font-medium">{authError}</span>
          </div>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Campo Login */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
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
                className={`w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border rounded-lg text-sm text-slate-800 placeholder-slate-400 outline-none transition-colors ${
                  usernameError
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                    : 'border-slate-300 focus:border-slate-500 focus:ring-1 focus:ring-slate-400'
                }`}
              />
            </div>
            {usernameError && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                {usernameError}
              </p>
            )}
          </div>

          {/* Campo Senha */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
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
                className={`w-full pl-3.5 pr-10 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border rounded-lg text-sm text-slate-800 placeholder-slate-400 outline-none transition-colors ${
                  passwordError
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                    : 'border-slate-300 focus:border-slate-500 focus:ring-1 focus:ring-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
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
              <p className="mt-1 text-xs text-red-600 font-medium">
                {passwordError}
              </p>
            )}
          </div>

          {/* Botão de Login (Deep Teal/Dark Blue com cantos arredondados conforme referência) */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 bg-[#093c44] hover:bg-[#062c33] active:scale-[0.99] text-white font-semibold text-sm tracking-wide rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
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
