import React, { useState } from 'react';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { authService } from '../services/authService';
import { User as UserType } from '../types';
import { Button } from '../components/button';

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
		<div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-brand-navy-dark font-body select-none">
			{/* Imagem de fundo corporativa logo.jpg com desfoque */}
			<div
				className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-105 filter blur-sm opacity-20 transition-all duration-700"
				style={{ backgroundImage: "url('/logo.jpg')" }}
				aria-hidden="true"
			/>

			{/* Degradê da marca: marinho → azul IANE */}
			<div className="absolute inset-0 bg-gradient-to-br from-brand-navy-dark via-brand-navy-base to-brand-blue-action" />

			{/* Card de Login Limpo */}
			<div className="relative z-10 w-full max-w-[390px] radius-lg bg-surface-card shadow-lg p-6 sm:p-8 border border-border-subtle transition-all">
				{/* Logo Superior Central */}
				<div className="flex flex-col items-center mb-6">
					<img
						src="/logo.png"
						alt="IANE - Gestão de Dispositivos"
						className="w-40 h-auto max-h-20 object-contain mb-2"
					/>
					<h1 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted text-center">
						Gestão de Dispositivos
					</h1>
				</div>

				{/* Alerta de erro de autenticação */}
				{authError && (
					<div className="mb-4 p-3 radius-base border border-status-danger-border bg-status-danger-bg text-xs text-status-danger-fg flex items-center gap-2">
						<AlertTriangle className="w-4 h-4 text-status-danger-fg shrink-0" />
						<span className="font-medium">{authError}</span>
					</div>
				)}

				{/* Formulário de Login */}
				<form onSubmit={handleSubmit} noValidate className="space-y-4">
					{/* Campo Login */}
					<div>
						<label
							htmlFor="username"
							className="block text-[11px] font-medium text-text-muted mb-1.5"
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
								className={`w-full h-10 radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 ${
									usernameError ? 'border-status-danger-border' : ''
								}`}
							/>
						</div>
						{usernameError && (
							<p className="mt-1 text-[11px] text-status-danger-fg font-medium">
								{usernameError}
							</p>
						)}
					</div>

					{/* Campo Senha */}
					<div>
						<label
							htmlFor="password"
							className="block text-[11px] font-medium text-text-muted mb-1.5"
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
								className={`w-full h-10 radius-base border border-border-subtle bg-surface-card pl-3 pr-10 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 ${
									passwordError ? 'border-status-danger-border' : ''
								}`}
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute inset-y-0 right-2 pr-2 flex items-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
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
							<p className="mt-1 text-[11px] text-status-danger-fg font-medium">
								{passwordError}
							</p>
						)}
					</div>

					{/* Botão de Login */}
					<Button type="submit" disabled={isLoading} className="w-full">
						{isLoading ? (
							<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
						) : (
							<span>Login</span>
						)}
					</Button>
				</form>
			</div>

			{/* Rodapé institucional discreto */}
			<footer className="absolute bottom-3 text-center text-[10px] text-text-muted/60 tracking-wider">
				IANE - Industria de Alimentos do Nordeste LTDA © {new Date().getFullYear()} — Todos os direitos reservados
			</footer>
		</div>
	);
};