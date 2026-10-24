import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, AlertCircle, Info, ShieldCheck } from 'lucide-react';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Por favor, informe o usuário e a senha.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.login({ username, password });
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.message || 'Credenciais inválidas. Verifique usuário e senha.');
      }
    } catch {
      setErrorMessage('Erro ao autenticar no servidor. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#0c3e7d] font-sans select-none">
      {/* 1. Imagem de fundo corporativa logo.jpg com desfoque suave */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-105 filter blur-xs opacity-40 transition-all duration-700"
        style={{
          backgroundImage: "url('/logo.jpg')",
        }}
        aria-hidden="true"
      />

      {/* 2. Camada gradiente azul corporativo para legibilidade e elegância */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b3c7b]/85 via-[#0d47a1]/80 to-[#072552]/95 backdrop-blur-[3px]" />

      {/* Brilhos e reflexos sutis de iluminação de fundo */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-400/20 rounded-full filter blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-400/15 rounded-full filter blur-3xl pointer-events-none" />

      {/* 3. Card Central de Login */}
      <div className="relative z-10 w-full max-w-sm px-6 py-8 mx-4 flex flex-col items-center">
        {/* Ícone Superior Central: icone.png */}
        <div className="mb-6 flex flex-col items-center">
          <div className="relative transition-transform duration-300 hover:scale-105 drop-shadow-2xl">
            <img
              src="/icone.png"
              alt="IANE"
              className="w-36 h-auto max-h-24 object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
            />
          </div>
          <span className="mt-3 text-xs font-semibold tracking-widest uppercase text-blue-100/90 text-center drop-shadow-sm">
            Gestão de Dispositivos
          </span>
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="w-full mb-4 px-3.5 py-2.5 rounded-lg bg-red-500/25 border border-red-400/40 text-red-100 text-xs flex items-center gap-2 animate-shake shadow-md">
            <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Formulário de Login */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Campo USERNAME */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/70">
              <User className="w-4 h-4" />
            </div>
            <input
              id="username-input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="USERNAME"
              className="w-full pl-10 pr-4 py-3 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/50 focus:border-white rounded-lg text-sm text-white placeholder-white/60 tracking-wider uppercase font-medium outline-hidden transition-all duration-200 shadow-inner"
              required
            />
          </div>

          {/* Campo PASSWORD */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/70">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="PASSWORD"
              className="w-full pl-10 pr-11 py-3 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/50 focus:border-white rounded-lg text-sm text-white placeholder-white/60 tracking-wider font-medium outline-hidden transition-all duration-200 shadow-inner"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/60 hover:text-white transition-colors cursor-pointer"
              tabIndex={-1}
              aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Botão LOGIN Branco conforme o modelo */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 bg-white hover:bg-slate-100 active:scale-[0.99] text-[#0d47a1] font-bold text-sm tracking-wider uppercase rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-[#0d47a1] border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>LOGIN</span>
            )}
          </button>
        </form>

        {/* Link Esqueci a Senha */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setIsForgotPasswordOpen(true)}
            className="text-xs text-white/80 hover:text-white transition-colors font-medium hover:underline cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
      </div>

      {/* Modal de Recuperação de Senha */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-slate-800 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Recuperação de Acesso</h3>
                <p className="text-xs text-slate-500">IANE - Gestão de Dispositivos</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed mb-6">
              <p>
                Por políticas de segurança interna e controle patrimonial, senhas de operadores e gestores são gerenciadas pelo setor de Tecnologia da Informação.
              </p>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-800">Suporte e Gestão de Contas:</p>
                <p className="text-blue-600 font-mono mt-0.5 select-all">tecnologia@iane.ind.br</p>
              </div>
              <p className="text-[11px] text-slate-400">
                Para redefinir sua senha diretamente no banco de dados PostgreSQL, execute o comando <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">UPDATE system_users</code>.
              </p>
            </div>

            <button
              onClick={() => setIsForgotPasswordOpen(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Voltar ao login
            </button>
          </div>
        </div>
      )}

      {/* Rodapé institucional discreto */}
      <footer className="absolute bottom-3 text-center text-[11px] text-white/50 tracking-wider">
        IANE Indústria e Comércio © {new Date().getFullYear()} — Todos os direitos reservados
      </footer>
    </div>
  );
};
