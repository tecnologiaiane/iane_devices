import React, { useState, useEffect, useRef } from 'react';
import { dataService } from '../services/dataStorage';
import { authService } from '../services/authService';
import { apiClient } from '../services/apiClient';
import { User, UserRole, SystemUserFormData, CatalogItem, Catalogs, CatalogType } from '../types';
import { todayISO } from '../utils/dates';
import { formatDate, formatDateTime } from '../utils/formatters';
import { Button } from '../components/button';
import { Badge } from '../components/badge';
import {
  Download,
  Upload,
  ShieldCheck,
  Database,
  History,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Users,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  X,
  CheckSquare,
  Square,
  ChevronDown,
  RefreshCw,
  Loader2,
  Server,
  ServerOff,
  HardDrive,
  Clock,
  ShieldAlert,
  RotateCcw,
  Search,
  Plus,
  Save,
  Building2,
} from 'lucide-react';

interface SettingsViewProps {
  onDataReset: () => void;
  currentUser?: User | null;
}

type SettingsSectionId = 'catalogs' | 'users' | 'backup' | 'audit' | 'danger';

interface BackupFileInfo {
	fileName: string;
	createdAt: string;
	size: number;
	origin: 'manual' | 'scheduled' | string;
}

interface BackupListPayload {
	backups: BackupFileInfo[];
	intervalHours: number;
	retention: number;
}

interface SettingsSectionProps {
	id: SettingsSectionId;
	title: string;
	description: string;
	icon: React.ElementType;
	badge?: string;
	isOpen: boolean;
	onToggle: (id: SettingsSectionId) => void;
	tone?: 'default' | 'danger';
	children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
	id,
	title,
	description,
	icon: Icon,
	badge,
	isOpen,
	onToggle,
	tone = 'default',
	children,
}) => (
	<section className="radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden">
		<button
			type="button"
			onClick={() => onToggle(id)}
			aria-expanded={isOpen}
			aria-controls={`settings-section-${id}`}
			className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-subtle transition-colors cursor-pointer"
		>
			<div
				className={`w-9 h-9 radius-base border flex items-center justify-center shrink-0 ${
					tone === 'danger'
						? 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
						: 'border-brand-blue-action/20 bg-brand-blue-action/10 text-brand-blue-action'
				}`}
			>
				<Icon className="w-5 h-5" />
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2 min-w-0">
					<h3 className="text-sm font-semibold text-text-primary truncate">{title}</h3>
					{badge && (
						<Badge variant="info" size="sm" className="text-[10px] shrink-0">
							{badge}
						</Badge>
					)}
				</div>
				<p className="text-[11px] text-text-muted truncate mt-0.5">{description}</p>
			</div>

			<ChevronDown
				className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${
					isOpen ? 'rotate-180' : ''
				}`}
			/>
		</button>

		{isOpen && (
			<div id={`settings-section-${id}`} className="border-t border-border-subtle">
				{children}
			</div>
		)}
	</section>
);

const AVAILABLE_PERMISSIONS = [
	{ id: 'dashboard', label: 'Dashboard & Indicadores', description: 'Visualizar painel geral e métricas de telefonia' },
	{ id: 'dispositivos', label: 'Dispositivos (Visualização)', description: 'Consultar inventário de smartphones e patrimônio' },
	{ id: 'dispositivos_edit', label: 'Dispositivos (Cadastro/Edição)', description: 'Cadastrar novos aparelhos e alterar dados técnicos' },
	{ id: 'linhas', label: 'Linhas Telefônicas (Visualização)', description: 'Consultar lista de chips, linhas e operadoras' },
	{ id: 'linhas_edit', label: 'Linhas (Cadastro/Edição)', description: 'Cadastrar e alterar números, planos e custos' },
	{ id: 'colaboradores', label: 'Colaboradores (Visualização)', description: 'Consultar colaboradores e departamentos' },
	{ id: 'colaboradores_edit', label: 'Colaboradores (Cadastro/Edição)', description: 'Cadastrar novos colaboradores e matrículas' },
	{ id: 'movimentacoes', label: 'Movimentações Patrimoniais', description: 'Executar fluxos de entrega, devolução, transferência e troca' },
	{ id: 'solicitacoes', label: 'Solicitações', description: 'Registrar e consultar solicitações de movimentação' },
	{ id: 'termos', label: 'Termos e Documentos', description: 'Emitir, imprimir e assinar termos de custódia' },
	{ id: 'relatorios', label: 'Relatórios & Exportações', description: 'Acessar relatórios analíticos e exportar dados' },
	{ id: 'configuracoes', label: 'Configurações & Backup', description: 'Acessar tela de configurações e cópias de segurança' },
	{ id: 'manage_users', label: 'Gerenciar Usuários (RBAC)', description: 'Criar, editar e excluir operadores e definir permissões (Super Admin)' },
];

const DEFAULT_ROLE_PERMS: Record<UserRole, string[]> = {
	admin: ['all', 'dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'solicitacoes', 'termos', 'relatorios', 'configuracoes', 'manage_users'],
	gestor: ['dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'solicitacoes', 'termos', 'relatorios', 'configuracoes'],
	operador: ['dashboard', 'dispositivos', 'linhas', 'colaboradores', 'movimentacoes', 'solicitacoes', 'termos'],
	visualizador: ['dashboard', 'dispositivos', 'linhas', 'colaboradores', 'relatorios'],
};

const formatFileSize = (bytes: number): string => {
	if (!bytes || bytes <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / Math.pow(1024, index);
	return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatBackupDate = (value: string): string => {
	try {
		return new Date(value).toLocaleString('pt-BR');
	} catch {
		return value;
	}
};

export const SettingsView: React.FC<SettingsViewProps> = ({
	onDataReset,
	currentUser: propUser,
}) => {
	const activeUser = propUser || authService.getCurrentUser();
	const canManageUsers = authService.canManageUsers(activeUser);
	const isAdmin = activeUser?.role === 'admin';

	const [auditLogs, setAuditLogs] = useState(dataService.getAuditLogs());
	const [successMessage, setSuccessMessage] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [openSection, setOpenSection] = useState<SettingsSectionId | null>(null);
	const [catalogs, setCatalogs] = useState<Catalogs>(() => dataService.getCatalogs());
	const [catalogSearch, setCatalogSearch] = useState<Record<CatalogType, string>>({ departments: '', sectors: '', models: '', brands: '', units: '', accessories: '', lineStatuses: '', deviceStatuses: '' });
	const [catalogDraft, setCatalogDraft] = useState<Record<CatalogType, string>>({ departments: '', sectors: '', models: '', brands: '', units: '', accessories: '', lineStatuses: '', deviceStatuses: '' });
	const [editingCatalogItem, setEditingCatalogItem] = useState<{ type: CatalogType; id: string } | null>(null);
	const [savingCatalog, setSavingCatalog] = useState<CatalogType | null>(null);

	const [serverHealth, setServerHealth] = useState<{
		database: string;
		environment: string;
	} | null>(null);
	const [isCheckingHealth, setIsCheckingHealth] = useState(false);
	const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);
	const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false);
	const dbDropdownRef = useRef<HTMLDivElement>(null);
	const [isSyncingWithDb, setIsSyncingWithDb] = useState(false);

	const [backups, setBackups] = useState<BackupFileInfo[]>([]);
	const [backupConfig, setBackupConfig] = useState({ intervalHours: 24, retention: 14 });
	const [loadingBackups, setLoadingBackups] = useState(false);
	const [isCreatingBackup, setIsCreatingBackup] = useState(false);
	const [downloadingBackup, setDownloadingBackup] = useState<string | null>(null);

	const [users, setUsers] = useState<User[]>([]);
	const [loadingUsers, setLoadingUsers] = useState(false);
	const [isUserModalOpen, setIsUserModalOpen] = useState(false);
	const [userToEdit, setUserToEdit] = useState<User | null>(null);

	const [formFullName, setFormFullName] = useState('');
	const [formUsername, setFormUsername] = useState('');
	const [formEmail, setFormEmail] = useState('');
	const [formPassword, setFormPassword] = useState('');
	const [formRole, setFormRole] = useState<UserRole>('operador');
	const [formPermissions, setFormPermissions] = useState<string[]>(DEFAULT_ROLE_PERMS['operador']);
	const [formActive, setFormActive] = useState(true);
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmittingUser, setIsSubmittingUser] = useState(false);

	const [isResetModalOpen, setIsResetModalOpen] = useState(false);
	const [resetConfirmText, setResetConfirmText] = useState('');
	const [resetAcknowledged, setResetAcknowledged] = useState(false);
	const [isResetting, setIsResetting] = useState(false);

	const checkHealth = async () => {
		setIsCheckingHealth(true);
		try {
			const response = await fetch('/api/health', { cache: 'no-store' });
			if (!response.ok) throw new Error('health check failed');
			const data = await response.json();
			setServerHealth({
				database: data.database || 'unknown',
				environment: data.environment || 'unknown',
			});
		} catch {
			setServerHealth({ database: 'unreachable', environment: 'unknown' });
		} finally {
			setIsCheckingHealth(false);
			setLastHealthCheck(new Date());
		}
	};

	const loadUsers = async () => {
		setLoadingUsers(true);
		try {
			const list = await dataService.getUsers();
			setUsers(list);
		} catch {
			// Mantém a lista anterior em caso de falha temporária
		} finally {
			setLoadingUsers(false);
		}
	};

	const loadBackups = async () => {
		setLoadingBackups(true);
		try {
			const res = await apiClient.get<BackupListPayload>('/api/backup');
			if (res.success && res.data) {
				setBackups(Array.isArray(res.data.backups) ? res.data.backups : []);
				setBackupConfig({
					intervalHours: res.data.intervalHours || 24,
					retention: res.data.retention || 14,
				});
			}
		} catch {
			// O dropdown permanece com o último estado conhecido
		} finally {
			setLoadingBackups(false);
		}
	};

	const loadCatalogs = async () => {
		const loaded = await dataService.fetchCatalogs();
		setCatalogs(loaded);
	};

	const catalogLabels: Record<CatalogType, string> = {
		departments: 'Departamentos', sectors: 'Setores', models: 'Modelos de aparelhos', brands: 'Marcas', units: 'Unidades da empresa', accessories: 'Acessórios para aparelhos', lineStatuses: 'Status das linhas telefônicas', deviceStatuses: 'Status dos aparelhos celulares',
	};

	const catalogUsageCount = (type: CatalogType, name: string): number => {
		const collaborators = dataService.getCollaborators();
		const devices = dataService.getDevices();
		const lines = dataService.getLines();
		if (type === 'departments') return collaborators.filter((item) => item.department === name).length + devices.filter((item) => item.currentDepartment === name).length + lines.filter((item) => item.department === name).length;
		if (type === 'sectors') return collaborators.filter((item) => item.sector === name).length + devices.filter((item) => item.sector === name).length;
		if (type === 'models') return devices.filter((item) => item.model === name).length + lines.filter((item) => item.associatedDeviceModel === name).length;
		if (type === 'brands') return devices.filter((item) => item.brand === name).length;
		if (type === 'units') return collaborators.filter((item) => item.unit === name).length + devices.filter((item) => item.unit === name).length + lines.filter((item) => item.unit === name).length;
		if (type === 'lineStatuses') return lines.filter((item) => item.status === name).length + dataService.getMovements().filter((item) => item.previousLineStatus === name || item.newLineStatus === name).length;
		if (type === 'deviceStatuses') return devices.filter((item) => item.status === name).length + dataService.getMovements().filter((item) => item.previousDeviceStatus === name || item.newDeviceStatus === name || item.stockTransit?.stockStatusAfter === name).length;
		return dataService.getMovements().filter((item) => item.accessoriesIncluded?.includes(name)).length + dataService.getTerms().filter((item) => item.accessoriesList?.includes(name)).length;
	};

	const persistCatalog = async (type: CatalogType, nextItems: CatalogItem[]) => {
		setSavingCatalog(type);
		setErrorMessage('');
		setSuccessMessage('');
		const result = await dataService.saveCatalog(type, nextItems);
		if (result.success && result.catalogs) {
			setCatalogs(result.catalogs);
			setSuccessMessage(`${catalogLabels[type]} atualizados.`);
			setEditingCatalogItem(null);
			setCatalogDraft((current) => ({ ...current, [type]: '' }));
		} else {
			setErrorMessage(result.message);
		}
		setSavingCatalog(null);
	};

	const handleCatalogSubmit = (type: CatalogType, item?: CatalogItem) => {
		const name = catalogDraft[type].trim();
		if (!name) {
			setErrorMessage('Informe o nome do item do cadastro.');
			return;
		}
		const items = catalogs[type] || [];
		if (items.some((existing) => existing.id !== item?.id && existing.name.trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
			setErrorMessage(`Já existe um item com esse nome em ${catalogLabels[type]}.`);
			return;
		}
		const next = item
			? items.map((existing) => existing.id === item.id ? { ...existing, name } : existing)
			: [...items, { id: `catalog-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name }];
		void persistCatalog(type, next);
	};

	const handleCatalogDelete = (type: CatalogType, item: CatalogItem) => {
		if ((type === 'lineStatuses' && ['line-status-available', 'line-status-in-use'].includes(item.id)) ||
			(type === 'deviceStatuses' && ['device-status-available', 'device-status-in-use'].includes(item.id))) {
			setErrorMessage('Este é um status operacional obrigatório e não pode ser excluído.');
			return;
		}
		const inUse = catalogUsageCount(type, item.name);
		if (inUse > 0) {
			setErrorMessage(`Não é possível excluir "${item.name}": está em uso por ${inUse} registro(s).`);
			return;
		}
		if (!window.confirm(`Excluir "${item.name}" de ${catalogLabels[type]}?`)) return;
		void persistCatalog(type, catalogs[type].filter((existing) => existing.id !== item.id));
	};

	useEffect(() => {
		void checkHealth();
		const timer = window.setInterval(() => {
			void checkHealth();
		}, 30000);

		if (canManageUsers) {
			void loadUsers();
		}
		if (isAdmin) {
			void loadBackups();
		}

		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		if (!isDbDropdownOpen) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (dbDropdownRef.current && !dbDropdownRef.current.contains(event.target as Node)) {
				setIsDbDropdownOpen(false);
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsDbDropdownOpen(false);
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [isDbDropdownOpen]);

	const handleToggleSection = (id: SettingsSectionId) => {
		setOpenSection((current) => (current === id ? null : id));

		if (id === 'catalogs') void loadCatalogs();
		if (id === 'audit') {
			void dataService
				.fetchAuditLogs()
				.then((logs) => setAuditLogs(logs))
				.catch(() => undefined);
		}
		if (id === 'users' && canManageUsers) {
			void loadUsers();
		}
		if (id === 'backup' && isAdmin && backups.length === 0) {
			void loadBackups();
		}
	};

	const handleForceSyncWithDatabase = async () => {
		setIsSyncingWithDb(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const res = await dataService.batchSyncToServer();
			if (res.success) {
				setSuccessMessage('Dados locais gravados no PostgreSQL com sucesso.');
				await checkHealth();
			} else {
				setErrorMessage(res.message);
			}
		} catch (err: any) {
			setErrorMessage(err.message || 'Erro ao comunicar com o servidor.');
		} finally {
			setIsSyncingWithDb(false);
		}
	};

	const handleCreateBackup = async () => {
		setIsCreatingBackup(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const res = await apiClient.post<BackupFileInfo>('/api/backup');
			if (res.success && res.data) {
				setSuccessMessage(`Backup ${res.data.fileName} gerado com sucesso.`);
				await loadBackups();
			} else {
				setErrorMessage(res.message || res.error || 'Não foi possível gerar o backup no servidor.');
			}
		} catch (err: any) {
			setErrorMessage(err.message || 'Não foi possível gerar o backup no servidor.');
		} finally {
			setIsCreatingBackup(false);
		}
	};

	const handleDownloadServerBackup = async (fileName: string) => {
		setDownloadingBackup(fileName);
		setErrorMessage('');
		try {
			const token = authService.getToken();
			const response = await fetch(`/api/backup/${encodeURIComponent(fileName)}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => null);
				throw new Error(payload?.message || 'Não foi possível baixar o backup.');
			}

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = fileName;
			link.click();
			URL.revokeObjectURL(url);
		} catch (err: any) {
			setErrorMessage(err.message || 'Não foi possível baixar o backup.');
		} finally {
			setDownloadingBackup(null);
		}
	};

	const handleDownloadLocalBackup = () => {
		const json = dataService.exportFullBackup();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `backup_iane_dispositivos_${todayISO()}.json`;
		link.click();
		URL.revokeObjectURL(url);
	};

	const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const content = event.target?.result as string;
			const res = dataService.importFullBackup(content);
			if (res.success) {
				setSuccessMessage(res.message);
				setErrorMessage('');
				setAuditLogs(dataService.getAuditLogs());
				onDataReset();
			} else {
				setErrorMessage(res.message);
				setSuccessMessage('');
			}
		};
		reader.readAsText(file);
		e.target.value = '';
	};

	const handleConfirmReset = async () => {
		if (!isAdmin || resetConfirmText.trim().toUpperCase() !== 'ZERAR' || !resetAcknowledged) {
			return;
		}

		setIsResetting(true);
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const res = await apiClient.post('/api/database/reset');
			if (!res.success) {
				setErrorMessage(res.message || res.error || 'O servidor recusou a operação. Nenhum dado foi removido.');
				return;
			}

			dataService.resetToDefaults(false);
			setAuditLogs(dataService.getAuditLogs());
			setSuccessMessage('Base de dados zerada com sucesso no servidor e neste navegador.');
			setIsResetModalOpen(false);
			setResetConfirmText('');
			setResetAcknowledged(false);
			onDataReset();
		} catch (err: any) {
			setErrorMessage(err.message || 'Não foi possível zerar a base de dados.');
		} finally {
			setIsResetting(false);
		}
	};

	const handleOpenCreateUser = () => {
		setUserToEdit(null);
		setFormFullName('');
		setFormUsername('');
		setFormEmail('');
		setFormPassword('');
		setFormRole('operador');
		setFormPermissions(DEFAULT_ROLE_PERMS['operador']);
		setFormActive(true);
		setShowPassword(false);
		setIsUserModalOpen(true);
	};

	const handleOpenEditUser = (u: User) => {
		setUserToEdit(u);
		setFormFullName(u.fullName);
		setFormUsername(u.username);
		setFormEmail(u.email || '');
		setFormPassword('');
		setFormRole(u.role);
		setFormPermissions(u.permissions || DEFAULT_ROLE_PERMS[u.role] || []);
		setFormActive(u.active !== false);
		setShowPassword(false);
		setIsUserModalOpen(true);
	};

	const handleRoleChange = (newRole: UserRole) => {
		setFormRole(newRole);
		if (!userToEdit) {
			setFormPermissions(DEFAULT_ROLE_PERMS[newRole] || []);
		}
	};

	const handleTogglePermission = (permId: string) => {
		if (formPermissions.includes(permId)) {
			setFormPermissions(formPermissions.filter((p) => p !== permId));
		} else {
			setFormPermissions([...formPermissions, permId]);
		}
	};

	const handleSelectAllPerms = () => {
		setFormPermissions(AVAILABLE_PERMISSIONS.map((p) => p.id));
	};

	const handleClearAllPerms = () => {
		setFormPermissions([]);
	};

	const handleSaveUser = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedUsername = formUsername.trim();

		if (!formFullName.trim() || !trimmedUsername) {
			setErrorMessage('Nome completo e nome de usuário são obrigatórios.');
			return;
		}

		if (
			trimmedUsername.length < 3 ||
			trimmedUsername.length > 100 ||
			!/^[A-Za-z0-9._@-]+$/.test(trimmedUsername)
		) {
			setErrorMessage(
				'O nome de usuário deve ter de 3 a 100 caracteres e usar apenas letras, números, ponto, hífen, underline ou @.'
			);
			return;
		}

		if (!userToEdit && (!formPassword || formPassword.trim().length < 6)) {
			setErrorMessage('Para novos usuários, defina uma senha com no mínimo 6 caracteres.');
			return;
		}

		setIsSubmittingUser(true);
		setErrorMessage('');
		setSuccessMessage('');

		const payload: SystemUserFormData = {
			id: userToEdit?.id,
			fullName: formFullName.trim(),
			username: trimmedUsername,
			email: formEmail.trim() || undefined,
			password: formPassword.trim() || undefined,
			role: formRole,
			permissions: formRole === 'admin' ? ['all', ...formPermissions] : formPermissions,
			active: formActive,
		};

		const res = await dataService.saveUser(payload);
		setIsSubmittingUser(false);

		if (res.success) {
			if (res.user && userToEdit && userToEdit.id === activeUser?.id) {
				authService.updateCurrentUser(res.user);
			}
			setSuccessMessage(res.message);
			setIsUserModalOpen(false);
			void loadUsers();
			setAuditLogs(dataService.getAuditLogs());
		} else {
			setErrorMessage(res.message);
		}
	};

	const handleDeleteUser = async (u: User) => {
		if (u.id === 'user-iane-super-1' || u.id === 'user-iane-super-2') {
			alert('O Super Administrador principal da IANE não pode ser excluído.');
			return;
		}

		if (u.id === activeUser?.id) {
			alert('Você não pode excluir seu próprio usuário logado no sistema.');
			return;
		}

		if (window.confirm(`Tem certeza que deseja excluir permanentemente o acesso do usuário "${u.fullName}" (@${u.username})?`)) {
			const res = await dataService.deleteUser(u.id);
			if (res.success) {
				setSuccessMessage(res.message);
				void loadUsers();
				setAuditLogs(dataService.getAuditLogs());
			} else {
				setErrorMessage(res.message);
			}
		}
	};

	const dbConnected = serverHealth?.database === 'connected';
	const dbUnreachable = serverHealth?.database === 'unreachable';
	const dbLabel = dbUnreachable
		? 'Servidor indisponível'
		: dbConnected
		? 'Banco conectado'
		: 'Banco desconectado';

	return (
		<div className="space-y-5">
			{/* Mensagens de Feedback */}
			{successMessage && (
				<div className="radius-lg border border-status-success-border bg-status-success-bg p-3 text-xs text-status-success-fg flex items-center justify-between gap-2 shadow-sm">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="w-4 h-4 text-status-success-fg shrink-0" />
						<span className="font-medium">{successMessage}</span>
					</div>
					<button onClick={() => setSuccessMessage('')} className="radius-base p-1 text-status-success-fg hover:bg-surface-subtle transition-colors" aria-label="Fechar mensagem">
						<X className="w-4 h-4" />
					</button>
				</div>
			)}

			{errorMessage && (
				<div className="radius-lg border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger-fg flex items-center justify-between gap-2 shadow-sm">
					<div className="flex items-center gap-2">
						<AlertTriangle className="w-4 h-4 text-status-danger-fg shrink-0" />
						<span className="font-medium">{errorMessage}</span>
					</div>
					<button onClick={() => setErrorMessage('')} className="radius-base p-1 text-status-danger-fg hover:bg-surface-subtle transition-colors" aria-label="Fechar mensagem">
						<X className="w-4 h-4" />
					</button>
				</div>
			)}

			{/* Status do banco + ações rápidas */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 radius-lg border border-border-subtle bg-surface-card shadow-sm p-4">
				<div className="flex items-center gap-3">
					<div className={`w-9 h-9 radius-base border flex items-center justify-center shrink-0 ${
						dbUnreachable ? 'border-status-danger-border bg-status-danger-bg text-status-danger-fg' : dbConnected ? 'border-status-success-border bg-status-success-bg text-status-success-fg' : 'border-border-subtle bg-surface-subtle text-text-muted'
					}`}>
						{dbUnreachable ? <ServerOff className="w-5 h-5" /> : dbConnected ? <Server className="w-5 h-5" /> : <HardDrive className="w-5 h-5" />}
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h3 className="text-sm font-semibold text-text-primary">Status do Banco de Dados</h3>
							{isCheckingHealth && <span className="text-[10px] font-medium text-brand-blue-action animate-pulse">Verificando…</span>}
						</div>
						<p className="text-[11px] text-text-muted">{dbLabel}</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" onClick={checkHealth} disabled={isCheckingHealth} className="flex items-center gap-1.5">
						<RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
						<span>Atualizar Status</span>
					</Button>
					{canManageUsers && (
						<Button variant="primary" size="sm" onClick={handleForceSyncWithDatabase} disabled={isSyncingWithDb} className="flex items-center gap-1.5">
							<RotateCcw className={`w-3.5 h-3.5 ${isSyncingWithDb ? 'animate-spin' : ''}`} />
							<span>Sincronizar com Servidor</span>
						</Button>
					)}
				</div>
			</div>

			{/* Seções de Configuração */}
			<div className="space-y-3">
				<SettingsSection
					id="catalogs"
					title="Catálogos do Sistema"
					description="Gerencie departamentos, setores, marcas, modelos, unidades, acessórios e status."
					icon={Building2}
					isOpen={openSection === 'catalogs'}
					onToggle={handleToggleSection}
				>
					{/* Catálogo content - simplified for brevity */}
					<div className="p-4 space-y-4">
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
							{Object.entries(catalogLabels).map(([type, label]) => {
								const items = catalogs[type as CatalogType] || [];
								const filtered = items.filter(i => !catalogSearch[type as CatalogType] || i.name.toLocaleLowerCase('pt-BR').includes(catalogSearch[type as CatalogType].toLocaleLowerCase('pt-BR')));
								return (
									<div key={type} className="radius-base border border-border-subtle bg-surface-subtle p-3">
										<div className="flex items-center justify-between mb-2">
											<span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</span>
											<Badge variant="info" size="sm">{filtered.length}</Badge>
										</div>
										<div className="space-y-1 max-h-40 overflow-y-auto">
											{filtered.map((item) => (
												<div key={item.id} className="flex items-center justify-between text-[11px] p-1.5 radius-base hover:bg-white cursor-pointer">
													<span className="truncate">{item.name}</span>
													<Button variant="ghost" size="sm" onClick={() => setEditingCatalogItem({ type: type as CatalogType, id: item.id })} className="p-1">
														<Edit2 className="w-3 h-3" />
													</Button>
												</div>
											))}
											{filtered.length === 0 && <p className="text-[10px] text-text-muted text-center py-2">Nenhum item cadastrado.</p>}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</SettingsSection>

				<SettingsSection
					id="users"
					title="Gerenciamento de Usuários"
					description="Crie, edite e defina permissões de acessos dos operadores."
					icon={Users}
					badge={canManageUsers ? undefined : 'Sem permissão'}
					isOpen={openSection === 'users'}
					onToggle={handleToggleSection}
				>
					<div className="p-4 space-y-4">
						<div className="flex items-center justify-between">
							<Button variant="primary" size="sm" onClick={handleOpenCreateUser} disabled={!canManageUsers} className="flex items-center gap-1.5 shrink-0">
								<UserPlus className="w-3.5 h-3.5" />
								<span>Novo Usuário</span>
							</Button>
						</div>
						<div className="overflow-x-auto">
							<table className="w-full text-left text-[11px] border-collapse">
								<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
									<tr>
										<th className="py-2.5 px-3">Usuário</th>
										<th className="py-2.5 px-3">Matrícula / Email</th>
										<th className="py-2.5 px-3">Papel</th>
										<th className="py-2.5 px-3">Status</th>
										<th className="py-2.5 px-3 text-right">Ações</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border-subtle">
									{users.map((u) => (
										<tr key={u.id} className="hover:bg-surface-subtle transition-colors group cursor-pointer">
											<td className="py-2.5 px-3 font-medium text-text-primary">{u.fullName}</td>
											<td className="py-2.5 px-3 font-code text-text-muted">{u.username} · {u.email || '—'}</td>
											<td className="py-2.5 px-3"><Badge variant="info" size="sm">{u.role}</Badge></td>
											<td className="py-2.5 px-3"><Badge variant={u.active !== false ? 'success' : 'danger'} size="sm">{u.active !== false ? 'Ativo' : 'Inativo'}</Badge></td>
											<td className="py-2.5 px-3 text-right space-x-1">
												<Button variant="ghost" size="sm" onClick={() => handleOpenEditUser(u)} disabled={!canManageUsers} className="p-1">
													<Edit2 className="w-3 h-3" />
												</Button>
												<Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u)} disabled={!canManageUsers} className="p-1 text-status-danger-fg hover:bg-status-danger-bg">
													<Trash2 className="w-3 h-3" />
												</Button>
											</td>
										</tr>
									))}
									{users.length === 0 && (
										<tr>
											<td colSpan={5} className="p-4 text-center text-text-muted">Nenhum usuário cadastrado.</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				</SettingsSection>

				<SettingsSection
					id="backup"
					title="Backup e Segurança"
					description="Gere, baixe e restaure cópias de segurança do banco de dados."
					icon={Database}
					isOpen={openSection === 'backup'}
					onToggle={handleToggleSection}
				>
					<div className="p-4 space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-semibold text-text-primary">Backup Local</h4>
							<div className="flex gap-2">
								<Button variant="ghost" size="sm" onClick={handleDownloadLocalBackup} className="flex items-center gap-1.5 shrink-0">
									<Download className="w-3.5 h-3.5" />
									<span>Baixar</span>
								</Button>
								<Button variant="ghost" size="sm" onClick={() => document.getElementById('import-backup-input')?.click()} className="flex items-center gap-1.5 shrink-0">
									<Upload className="w-3.5 h-3.5" />
									<span>Restaurar</span>
								</Button>
								<input type="file" id="import-backup-input" className="hidden" accept=".json" onChange={handleImportBackup} />
							</div>
						</div>
						{isAdmin && (
							<div className="pt-4 border-t border-border-subtle">
								<h4 className="text-sm font-semibold text-text-primary">Backup no Servidor</h4>
								<Button variant="primary" size="sm" onClick={handleCreateBackup} disabled={isCreatingBackup} className="flex items-center gap-1.5 shrink-0">
									{isCreatingBackup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
									<span>{isCreatingBackup ? 'Criando…' : 'Gerar Backup no Servidor'}</span>
								</Button>
								{backups.length > 0 && (
									<div className="mt-3 space-y-2">
										{backups.map((b) => (
											<div key={b.fileName} className="flex items-center justify-between text-[11px] p-2 radius-base border border-border-subtle bg-surface-card">
												<div>
													<span className="font-medium text-text-primary truncate">{b.fileName}</span>
													<span className="text-text-muted block">{formatBackupDate(b.createdAt)} · {formatFileSize(b.size)}</span>
												</div>
												<Button variant="ghost" size="sm" onClick={() => handleDownloadServerBackup(b.fileName)} disabled={downloadingBackup === b.fileName}>
													{downloadingBackup === b.fileName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
												</Button>
											</div>
										))}
									</div>
								)}
							</div>
						)}
					</div>
				</SettingsSection>

				<SettingsSection
					id="audit"
					title="Log de Auditoria"
					description="Acompanhe alterações de dados, exclusões e eventos do sistema."
					icon={History}
					isOpen={openSection === 'audit'}
					onToggle={handleToggleSection}
				>
					<div className="p-4 space-y-4">
						<div className="overflow-x-auto">
							<table className="w-full text-left text-[11px] border-collapse">
								<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
									<tr>
										<th className="py-2.5 px-3">Data/Hora</th>
										<th className="py-2.5 px-3">Ação</th>
										<th className="py-2.5 px-3">Usuário</th>
										<th className="py-2.5 px-3">Detalhes</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border-subtle">
									{auditLogs.slice(0, 20).map((log) => (
										<tr key={log.id} className="hover:bg-surface-subtle transition-colors">
											<td className="py-2.5 px-3 font-code text-text-muted">{formatDateTime(log.timestamp)}</td>
											<td className="py-2.5 px-3 font-medium text-text-primary">{log.action}</td>
											<td className="py-2.5 px-3 font-code text-text-muted">{log.user || '—'}</td>
											<td className="py-2.5 px-3 text-text-muted truncate max-w-[200px]">{log.details || '—'}</td>
										</tr>
									))}
									{auditLogs.length === 0 && (
										<tr>
											<td colSpan={4} className="p-4 text-center text-text-muted">Nenhum registro de auditoria.</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				</SettingsSection>

				{isAdmin && (
					<SettingsSection
						id="danger"
						title="Zona de Perigo"
						description="Ações destrutivas que afetam todos os dados do sistema."
						icon={ShieldAlert}
						tone="danger"
						isOpen={openSection === 'danger'}
						onToggle={handleToggleSection}
					>
						<div className="p-4 space-y-4">
							<div className="p-3 radius-base border border-status-danger-border bg-status-danger-bg/10">
								<h4 className="text-sm font-semibold text-status-danger-fg">Resetar Base de Dados</h4>
								<p className="text-[11px] text-status-danger-fg/80 mt-0.5">
									Esta ação apaga TODOS os dados cadastrados no sistema. Não pode ser desfeita.
								</p>
								<div className="mt-3 space-y-2">
									<input
										type="text"
										value={resetConfirmText}
										onChange={(e) => {
											setResetConfirmText(e.target.value);
											setResetAcknowledged(e.target.value.trim().toUpperCase() === 'ZERAR');
										}}
										placeholder="Digite ZERAR para confirmar"
										className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 uppercase"
									/>
									<label className="flex items-center gap-2 text-[11px] text-status-danger-fg/80 cursor-pointer select-none">
										<input
											type="checkbox"
											checked={resetAcknowledged}
											onChange={() => setResetAcknowledged(!resetAcknowledged)}
											className="radius-base border border-border-subtle text-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
										/>
										Entendo que esta ação é irreversível e apaga todos os dados.
									</label>
									<Button variant="destructive" size="sm" onClick={handleConfirmReset} disabled={!isAdmin || resetConfirmText.trim().toUpperCase() !== 'ZERAR' || !resetAcknowledged || isResetting} className="flex items-center gap-1.5">
										{isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
										<span>{isResetting ? 'Zerando…' : 'Confirmar Reset Total'}</span>
									</Button>
								</div>
							</div>
						</div>
					</SettingsSection>
				)}
			</div>

			{/* Modal de Usuário */}
			{isUserModalOpen && (
				<div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
					<div className="fixed inset-0 bg-brand-navy-dark/45 backdrop-blur-sm" onClick={() => setIsUserModalOpen(false)} />
					<div className="flex min-h-full items-center justify-center p-4">
						<div className="relative bg-surface-card radius-lg border border-border-subtle shadow-lg w-full max-w-md p-5 space-y-4">
							<div className="flex items-center justify-between border-b border-border-subtle pb-3">
								<h3 className="text-sm font-semibold text-text-primary">
									{userToEdit ? 'Editar Usuário' : 'Cadastrar Usuário'}
								</h3>
								<button onClick={() => setIsUserModalOpen(false)} className="radius-base p-1.5 text-text-muted hover:bg-surface-subtle transition-colors">
									<X className="w-4 h-4" />
								</button>
							</div>
							<form onSubmit={handleSaveUser} className="space-y-3">
								<div>
									<label className="block text-[11px] font-medium text-text-muted mb-1.5">Nome Completo *</label>
									<input type="text" value={formFullName} onChange={(e) => setFormFullName(e.target.value)} placeholder="Carlos Eduardo Mendes" className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15" required />
								</div>
								<div>
									<label className="block text-[11px] font-medium text-text-muted mb-1.5">Nome de Usuário *</label>
									<input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="carlos.mendes" className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15" required />
								</div>
								<div>
									<label className="block text-[11px] font-medium text-text-muted mb-1.5">E-mail</label>
									<input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="carlos@empresa.com.br" className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15" />
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div>
										<label className="block text-[11px] font-medium text-text-muted mb-1.5">Papel *</label>
										<select value={formRole} onChange={(e) => handleRoleChange(e.target.value as UserRole)} className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15" required>
											<option value="admin">Administrador</option>
											<option value="gestor">Gestor de Telefonia</option>
											<option value="operador">Operador de TI/RH</option>
											<option value="visualizador">Visualizador</option>
										</select>
									</div>
									<div>
										<label className="block text-[11px] font-medium text-text-muted mb-1.5">Status</label>
										<select value={formActive ? 'true' : 'false'} onChange={(e) => setFormActive(e.target.value === 'true')} className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15">
											<option value="true">Ativo</option>
											<option value="false">Inativo</option>
										</select>
									</div>
								</div>
								{!userToEdit && (
									<div>
										<label className="block text-[11px] font-medium text-text-muted mb-1.5">Senha *</label>
										<div className="relative">
											<input
												type={showPassword ? 'text' : 'password'}
												value={formPassword}
												onChange={(e) => setFormPassword(e.target.value)}
												placeholder="•••••• (mín. 6 caracteres)"
												className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 pr-10 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
												required
											/>
											<button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
												{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
											</button>
										</div>
									</div>
								)}
								<div className="pt-3 border-t border-border-subtle">
									<h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">Permissões</h4>
									<div className="flex flex-wrap gap-1 mb-3">
										{DEFAULT_ROLE_PERMS[formRole as keyof typeof DEFAULT_ROLE_PERMS]?.map((p) => (
											<button
												key={p}
												type="button"
												onClick={() => handleTogglePermission(p)}
												className={`px-2.5 py-1 radius-full text-[10px] transition-colors ${formPermissions.includes(p) ? 'bg-brand-blue-action/10 text-brand-blue-action border border-brand-blue-action/30' : 'bg-surface-subtle text-text-muted border border-border-subtle'}`}
											>
												{p}
											</button>
										))}
										<div className="mt-2 flex gap-2">
											<Button variant="ghost" size="sm" onClick={handleSelectAllPerms} className="text-[10px] px-2 py-1">Selecionar Todas</Button>
											<Button variant="ghost" size="sm" onClick={handleClearAllPerms} className="text-[10px] px-2 py-1">Limpar Todas</Button>
										</div>
									</div>
								</div>
								<div className="flex justify-end gap-2 pt-2">
									<Button variant="ghost" size="sm" onClick={() => setIsUserModalOpen(false)}>
										Cancelar
									</Button>
									<Button variant="primary" size="sm" type="submit" disabled={isSubmittingUser}>
										{isSubmittingUser ? 'Salvando…' : userToEdit ? 'Salvar Alterações' : 'Cadastrar Usuário'}
									</Button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};