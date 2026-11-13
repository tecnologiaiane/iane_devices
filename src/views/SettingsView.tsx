import React, { useState, useEffect, useRef } from 'react';
import { dataService } from '../services/dataStorage';
import { authService } from '../services/authService';
import { apiClient } from '../services/apiClient';
import { User, UserRole, SystemUserFormData, CatalogItem, Catalogs, CatalogType } from '../types';
import { todayISO } from '../utils/dates';
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
  <section className="bg-white rounded-xl border border-ink-200 shadow-xs overflow-hidden">
    <button
      type="button"
      onClick={() => onToggle(id)}
      aria-expanded={isOpen}
      aria-controls={`settings-section-${id}`}
      className="w-full flex items-center gap-3 p-4 text-left hover:bg-ink-50/60 transition-colors cursor-pointer"
    >
      <div
        className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
          tone === 'danger'
            ? 'bg-rose-50 border-rose-200 text-rose-600'
            : 'bg-iane-50 border-iane-200 text-iane-600'
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-ink-900 truncate">{title}</h3>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ink-100 text-ink-600 border border-ink-200 shrink-0">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-500 truncate mt-0.5">{description}</p>
      </div>

      <ChevronDown
        className={`w-4 h-4 text-ink-400 shrink-0 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>

    {isOpen && (
      <div id={`settings-section-${id}`} className="border-t border-ink-100">
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

  // Status do banco (dropdown minimalista no canto)
  const [serverHealth, setServerHealth] = useState<{
    database: string;
    environment: string;
  } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);
  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(false);
  const dbDropdownRef = useRef<HTMLDivElement>(null);
  const [isSyncingWithDb, setIsSyncingWithDb] = useState(false);

  // Backup no servidor
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [backupConfig, setBackupConfig] = useState({ intervalHours: 24, retention: 14 });
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState<string | null>(null);

  // Estados de Gestão de Usuários
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  // Formulário de Usuário
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('operador');
  const [formPermissions, setFormPermissions] = useState<string[]>(DEFAULT_ROLE_PERMS['operador']);
  const [formActive, setFormActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Confirmação reforçada de limpeza total
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

  // Fecha o dropdown de status do banco ao clicar fora ou pressionar Esc
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

      // Limpa apenas o cache local: o PostgreSQL já foi zerado pela chamada acima.
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
      // Se o próprio usuário logado alterou o login/credenciais, reflete na sessão atual.
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
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-700 hover:text-emerald-900 cursor-pointer" aria-label="Fechar mensagem">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-700 hover:text-rose-900 cursor-pointer" aria-label="Fechar mensagem">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cabeçalho da tela + status do banco em dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink-900">Configurações e administração</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Cadastros, backup, usuários e auditoria organizados em seções recolhíveis.
          </p>
        </div>

        <div ref={dbDropdownRef} className="relative self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsDbDropdownOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isDbDropdownOpen}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-ink-200 text-xs font-semibold text-ink-700 shadow-xs hover:bg-ink-50 transition-colors cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                dbConnected ? 'bg-emerald-500' : dbUnreachable ? 'bg-rose-500' : 'bg-amber-500'
              }`}
            />
            <span>{dbLabel}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-ink-400 transition-transform ${
                isDbDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isDbDropdownOpen && (
            <div
              role="menu"
              aria-label="Status da conexão com o banco"
              className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-ink-200 shadow-xl z-50 overflow-hidden"
            >
              <div className="flex items-start gap-2.5 p-3.5">
                <div
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                    dbConnected
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      : dbUnreachable
                      ? 'bg-rose-50 border-rose-200 text-rose-600'
                      : 'bg-amber-50 border-amber-200 text-amber-600'
                  }`}
                >
                  {dbConnected ? <Server className="w-4 h-4" /> : <ServerOff className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink-900">
                    {dbConnected ? 'PostgreSQL conectado' : dbUnreachable ? 'Servidor sem resposta' : 'PostgreSQL desconectado'}
                  </p>
                  <p className="text-[11px] text-ink-500 leading-snug mt-0.5">
                    {dbConnected
                      ? 'Leitura e gravação na base corporativa.'
                      : 'O sistema mantém os dados no cache local até reconectar.'}
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-2.5 border-t border-ink-100 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink-500">Ambiente</span>
                  <span className="font-semibold text-ink-800">
                    {serverHealth?.environment === 'production' ? 'Produção' : 'Desenvolvimento'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink-500">Última verificação</span>
                  <span className="font-mono text-ink-700">
                    {lastHealthCheck ? lastHealthCheck.toLocaleTimeString('pt-BR') : '—'}
                  </span>
                </div>
              </div>

              <div className="p-2 border-t border-ink-100 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void checkHealth()}
                  disabled={isCheckingHealth}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-ink-700 hover:bg-ink-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  Verificar
                </button>
                <button
                  type="button"
                  onClick={() => void handleForceSyncWithDatabase()}
                  disabled={isSyncingWithDb || !dbConnected}
                  title="Grava os dados locais no PostgreSQL"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-iane-700 hover:bg-iane-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Database className={`w-3 h-3 ${isSyncingWithDb ? 'animate-spin' : ''}`} />
                  Sincronizar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsSection
        id="catalogs"
        title="Cadastros"
        description="Gerencie departamentos, setores, marcas, modelos e unidades usados nos formulários."
        icon={Database}
        badge={`${Object.values(catalogs).reduce((sum, items) => sum + items.length, 0)} itens`}
        isOpen={openSection === 'catalogs'}
        onToggle={handleToggleSection}
      >
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(Object.keys(catalogLabels) as CatalogType[]).map((type) => {
              const query = catalogSearch[type].trim().toLocaleLowerCase('pt-BR');
              const visibleItems = (catalogs[type] || []).filter((item) => item.name.toLocaleLowerCase('pt-BR').includes(query));
              const editing = editingCatalogItem?.type === type;
              const editingItem = editing ? catalogs[type].find((item) => item.id === editingCatalogItem?.id) : undefined;
              return (
                <section key={type} className="rounded-lg border border-ink-200 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-ink-900">{catalogLabels[type]}</h3>
                    <span className="text-[10px] text-ink-400 tabular-nums">{catalogs[type]?.length || 0} itens</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-400" />
                    <input value={catalogSearch[type]} onChange={(event) => setCatalogSearch((current) => ({ ...current, [type]: event.target.value }))} placeholder={`Buscar em ${catalogLabels[type].toLowerCase()}...`} className="w-full rounded-lg border border-ink-300 bg-white py-2 pl-8 pr-3 text-xs text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500" />
                  </div>
                  {editingItem ? (
                    <form onSubmit={(event) => { event.preventDefault(); handleCatalogSubmit(type, editingItem); }} className="flex gap-2">
                      <input autoFocus value={catalogDraft[type]} onChange={(event) => setCatalogDraft((current) => ({ ...current, [type]: event.target.value }))} aria-label="Nome" placeholder="Nome" className="min-w-0 flex-1 rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500" />
                      <button type="submit" disabled={savingCatalog === type} className="inline-flex items-center gap-1 rounded-lg bg-iane-600 px-3 py-2 text-xs font-semibold text-white hover:bg-iane-700 disabled:opacity-50"><Save className="h-3.5 w-3.5" />Salvar</button>
                      <button type="button" onClick={() => { setEditingCatalogItem(null); setCatalogDraft((current) => ({ ...current, [type]: '' })); }} className="rounded-lg bg-ink-100 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-200">Cancelar</button>
                    </form>
                  ) : (
                    <form onSubmit={(event) => { event.preventDefault(); handleCatalogSubmit(type); }} className="flex gap-2">
                      <input value={catalogDraft[type]} onChange={(event) => setCatalogDraft((current) => ({ ...current, [type]: event.target.value }))} aria-label="Nome" placeholder="Nome" className="min-w-0 flex-1 rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500" />
                      <button type="submit" disabled={savingCatalog === type} className="inline-flex items-center gap-1 rounded-lg bg-iane-600 px-3 py-2 text-xs font-semibold text-white hover:bg-iane-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Adicionar</button>
                    </form>
                  )}
                  <ul className="max-h-48 divide-y divide-ink-100 overflow-y-auto rounded-md border border-ink-100">
                    {visibleItems.length ? visibleItems.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 px-2.5 py-2 hover:bg-ink-50/70">
                        <span className="min-w-0 flex-1 truncate text-xs text-ink-700">{item.name}</span>
                        <button type="button" title="Editar" onClick={() => { setEditingCatalogItem({ type, id: item.id }); setCatalogDraft((current) => ({ ...current, [type]: item.name })); setErrorMessage(''); }} className="rounded p-1 text-ink-400 hover:bg-iane-50 hover:text-iane-700"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button type="button" title="Excluir" onClick={() => handleCatalogDelete(type, item)} className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    )) : <li className="px-3 py-4 text-center text-[11px] text-ink-400">{query ? 'Nenhum resultado.' : 'Nenhum item cadastrado.'}</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      {/* Gestão de Usuários */}
      {canManageUsers && (
        <SettingsSection
          id="users"
          title="Gestão de usuários e permissões"
          description="Cadastre operadores, altere o nome de login e defina o acesso por módulo."
          icon={Users}
          badge={`${users.length} cadastrados`}
          isOpen={openSection === 'users'}
          onToggle={handleToggleSection}
        >
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-ink-500">
                Controle de acesso baseado em perfis (RBAC). Apenas administradores e gestores autorizados podem alterar usuários.
              </p>
              <button
                onClick={handleOpenCreateUser}
                className="py-2 px-3.5 bg-iane-600 hover:bg-iane-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Novo Usuário</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-ink-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-ink-50 text-ink-600 font-semibold border-b border-ink-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Nome & Login</th>
                    <th className="py-3 px-4">E-mail Corporativo</th>
                    <th className="py-3 px-4">Papel (Perfil)</th>
                    <th className="py-3 px-4">Módulos Autorizados</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-ink-400">
                        Carregando usuários do sistema...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-ink-400">
                        Nenhum usuário cadastrado.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isAdminUser = u.role === 'admin';
                      const isCurrentSuper = u.id === 'user-iane-super-1' || u.id === 'user-iane-super-2';
                      const isMyself = u.id === activeUser?.id;

                      const roleBadgeClass = {
                        admin: 'bg-purple-100 text-purple-800 border-purple-200',
                        gestor: 'bg-iane-100 text-iane-800 border-iane-200',
                        operador: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                        visualizador: 'bg-ink-100 text-ink-700 border-ink-200',
                      }[u.role] || 'bg-ink-100 text-ink-700';

                      const roleLabel = {
                        admin: 'Super Administrador',
                        gestor: 'Gestor de Telefonia',
                        operador: 'Operador de TI/RH',
                        visualizador: 'Visualizador (Leitura)',
                      }[u.role] || u.role;

                      const hasAll = isAdminUser || u.permissions?.includes('all');
                      const countPerms = hasAll ? AVAILABLE_PERMISSIONS.length : (u.permissions?.length || 0);

                      return (
                        <tr key={u.id} className="hover:bg-ink-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-ink-900 flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              {isMyself && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-iane-50 text-iane-700 border border-iane-200 rounded font-normal">
                                  Você
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-ink-400 font-mono">@{u.username}</div>
                          </td>

                          <td className="py-3 px-4 text-ink-600">
                            {u.email || <span className="text-ink-400 italic">Não informado</span>}
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${roleBadgeClass}`}>
                              {roleLabel}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-ink-700 font-medium">
                              {hasAll ? (
                                <span className="text-emerald-700 font-semibold">Acesso Total ({AVAILABLE_PERMISSIONS.length} módulos)</span>
                              ) : (
                                `${countPerms} de ${AVAILABLE_PERMISSIONS.length} módulos`
                              )}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${u.active !== false ? 'text-emerald-700' : 'text-ink-400'}`}>
                              <span className={`w-2 h-2 rounded-full ${u.active !== false ? 'bg-emerald-500' : 'bg-ink-300'}`} />
                              {u.active !== false ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                title="Editar Usuário e Permissões"
                                className="p-1.5 text-ink-500 hover:text-iane-600 hover:bg-iane-50 rounded-md transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u)}
                                disabled={isCurrentSuper || isMyself}
                                title={isCurrentSuper ? 'Super Admin principal não pode ser excluído' : isMyself ? 'Você não pode excluir seu próprio login' : 'Excluir Usuário'}
                                className={`p-1.5 rounded-md transition-colors ${
                                  isCurrentSuper || isMyself
                                    ? 'text-ink-300 cursor-not-allowed'
                                    : 'text-ink-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* Backup e restauração */}
      <SettingsSection
        id="backup"
        title="Backup e restauração"
        description={
          isAdmin
            ? `Cópias automáticas a cada ${backupConfig.intervalHours}h · retenção de ${backupConfig.retention} arquivos.`
            : 'Cópia local dos dados em JSON.'
        }
        icon={HardDrive}
        isOpen={openSection === 'backup'}
        onToggle={handleToggleSection}
      >
        <div className="p-4 sm:p-5 space-y-5">
          {isAdmin ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-900">Backup automático do PostgreSQL</p>
                    <p className="text-[11px] text-ink-500 leading-snug mt-0.5">
                      Rotina no servidor, executada a cada {backupConfig.intervalHours} horas. Inclui os PDFs dos termos.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => void handleCreateBackup()}
                  disabled={isCreatingBackup || !dbConnected}
                  title={!dbConnected ? 'Conecte o PostgreSQL para gerar o backup' : 'Gerar uma cópia completa agora'}
                  className="py-2 px-3.5 bg-iane-600 hover:bg-iane-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isCreatingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  <span>{isCreatingBackup ? 'Gerando backup...' : 'Fazer backup agora'}</span>
                </button>
              </div>

              <div className="border border-ink-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-ink-50 border-b border-ink-200 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-ink-600 uppercase tracking-wider">
                    Cópias no servidor
                  </span>
                  <button
                    onClick={() => void loadBackups()}
                    disabled={loadingBackups}
                    title="Atualizar lista"
                    className="p-1 text-ink-500 hover:text-iane-600 rounded transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {loadingBackups && backups.length === 0 ? (
                  <p className="px-3 py-5 text-center text-[11px] text-ink-400">Carregando backups...</p>
                ) : backups.length === 0 ? (
                  <p className="px-3 py-5 text-center text-[11px] text-ink-400">
                    Nenhum backup ainda. A primeira cópia automática é criada após o servidor conectar ao banco.
                  </p>
                ) : (
                  <ul className="divide-y divide-ink-100 max-h-56 overflow-y-auto">
                    {backups.map((backup) => (
                      <li key={backup.fileName} className="flex items-center gap-3 px-3 py-2 hover:bg-ink-50/60">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-ink-800 truncate">
                            {backup.origin === 'scheduled' ? 'Automático' : 'Manual'} · {formatBackupDate(backup.createdAt)}
                          </p>
                          <p className="text-[10px] font-mono text-ink-400 truncate">
                            {backup.fileName} · {formatFileSize(backup.size)}
                          </p>
                        </div>
                        <button
                          onClick={() => void handleDownloadServerBackup(backup.fileName)}
                          disabled={downloadingBackup === backup.fileName}
                          title="Baixar este backup"
                          className="p-1.5 text-ink-500 hover:text-iane-600 hover:bg-iane-50 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {downloadingBackup === backup.fileName ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-ink-50 border border-ink-200">
              <ShieldAlert className="w-4 h-4 text-ink-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-ink-600 leading-relaxed">
                O backup completo do servidor é exclusivo para administradores. Use a cópia local em JSON abaixo.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-ink-100">
            <p className="text-[11px] font-semibold text-ink-600 uppercase tracking-wider mb-2">
              Cópia local em JSON
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDownloadLocalBackup}
                className="py-2 px-3 bg-ink-100 hover:bg-ink-200 text-ink-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-ink-600" />
                <span>Baixar JSON</span>
              </button>

              <label className="py-2 px-3 bg-ink-100 hover:bg-ink-200 text-ink-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-ink-600" />
                <span>Restaurar JSON</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
            <p className="text-[10px] text-ink-400 leading-snug mt-2">
              O JSON local contém cadastros e movimentações, mas não os PDFs dos termos. Para recuperação completa, use as cópias do servidor.
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* Trilha de Auditoria */}
      <SettingsSection
        id="audit"
        title="Trilha de auditoria"
        description="Histórico de operações realizadas no sistema."
        icon={History}
        badge={`${auditLogs.length} eventos`}
        isOpen={openSection === 'audit'}
        onToggle={handleToggleSection}
      >
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-ink-50 border-b border-ink-200 text-ink-600 font-semibold text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Entidade</th>
                <th className="py-2.5 px-3">Identificador</th>
                <th className="py-2.5 px-3">Operação / Detalhes</th>
                <th className="py-2.5 px-3">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-400">
                    Nenhum evento registrado.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-ink-50/50">
                    <td className="py-2 px-3 font-mono text-ink-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2 px-3 font-semibold text-ink-800">{log.entityType}</td>
                    <td className="py-2 px-3 font-mono text-iane-700">{log.entityLabel}</td>
                    <td className="py-2 px-3 text-ink-700">{log.details}</td>
                    <td className="py-2 px-3 text-ink-500">{log.user}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      {/* Área administrativa sensível */}
      {isAdmin && (
        <SettingsSection
          id="danger"
          title="Área administrativa avançada"
          description="Operações irreversíveis. Use somente com backup recente."
          icon={ShieldAlert}
          tone="danger"
          isOpen={openSection === 'danger'}
          onToggle={handleToggleSection}
        >
          <div className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-rose-200 bg-rose-50/60">
              <div className="flex items-start gap-2.5">
                <RotateCcw className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-rose-900">Zerar todos os dados</p>
                  <p className="text-[11px] text-rose-700 leading-snug mt-0.5">
                    Remove aparelhos, linhas, colaboradores, movimentações, termos e auditoria do PostgreSQL e deste navegador.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setResetConfirmText('');
                  setResetAcknowledged(false);
                  setIsResetModalOpen(true);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-100 border border-rose-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
              >
                Zerar dados...
              </button>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* =========================================================================
          MODAL DE CADASTRO / EDIÇÃO DE USUÁRIO (RBAC)
          ========================================================================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-ink-200 my-8">
            <div className="px-6 py-4 bg-ink-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-iane-400" />
                <h3 className="font-bold text-sm">
                  {userToEdit ? 'Editar Usuário e Permissões' : 'Cadastrar Novo Operador'}
                </h3>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-ink-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-5">
              {/* Dados Básicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo Silva"
                    className="w-full text-xs px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iane-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Nome de Usuário (Login) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isAdmin}
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="Ex: carlos.silva"
                    className="w-full text-xs px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iane-500 disabled:bg-ink-100 disabled:text-ink-500 disabled:cursor-not-allowed"
                  />
                  <p className="mt-1 text-[11px] text-ink-500">
                    {!isAdmin
                      ? 'Somente o Super Admin pode alterar o nome de login.'
                      : userToEdit
                        ? 'Pode ser alterado a qualquer momento. O novo login vale no próximo acesso.'
                        : 'Letras, números, ponto, hífen, underline ou @ (mínimo 3 caracteres).'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="Ex: carlos.silva@iane.ind.br"
                    className="w-full text-xs px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iane-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    {userToEdit ? 'Nova Senha (deixe em branco p/ manter)' : 'Senha de Acesso (Mín. 6 chars) *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!userToEdit}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={userToEdit ? '••••••••' : 'Defina a senha'}
                      className="w-full text-xs px-3 py-2 pr-9 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iane-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Papel do Usuário */}
              <div className="p-4 bg-ink-50 border border-ink-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink-800">
                    Papel / Perfil de Acesso
                  </label>
                  <span className="text-[11px] text-ink-500">
                    Determina o nível padrão de privilégios
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['admin', 'gestor', 'operador', 'visualizador'] as UserRole[]).map((roleKey) => {
                    const isSelected = formRole === roleKey;
                    const labels: Record<UserRole, string> = {
                      admin: 'Super Admin',
                      gestor: 'Gestor',
                      operador: 'Operador',
                      visualizador: 'Visualizador',
                    };
                    return (
                      <button
                        type="button"
                        key={roleKey}
                        onClick={() => handleRoleChange(roleKey)}
                        className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-iane-600 text-white border-iane-600 shadow-xs'
                            : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-100'
                        }`}
                      >
                        {labels[roleKey]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Módulos e Permissões Granulares */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-ink-900">
                      Permissões por Módulo do Sistema
                    </h4>
                    <p className="text-[11px] text-ink-500">
                      Marque exatamente o que este usuário tem autorização para visualizar ou modificar
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllPerms}
                      className="text-iane-600 hover:underline font-medium cursor-pointer"
                    >
                      Marcar todos
                    </button>
                    <span className="text-ink-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllPerms}
                      className="text-ink-500 hover:underline font-medium cursor-pointer"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-ink-200 rounded-xl bg-ink-50/50">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = formRole === 'admin' || formPermissions.includes(perm.id) || formPermissions.includes('all');
                    return (
                      <div
                        key={perm.id}
                        onClick={() => formRole !== 'admin' && handleTogglePermission(perm.id)}
                        className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition-colors ${
                          formRole === 'admin'
                            ? 'bg-purple-50/40 border-purple-200 cursor-not-allowed opacity-90'
                            : isChecked
                            ? 'bg-iane-50/60 border-iane-200 cursor-pointer'
                            : 'bg-white border-ink-200 hover:bg-ink-50 cursor-pointer'
                        }`}
                      >
                        <div className="pt-0.5 shrink-0 text-iane-600">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-iane-600" />
                          ) : (
                            <Square className="w-4 h-4 text-ink-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-ink-900 leading-tight">
                            {perm.label}
                          </div>
                          <div className="text-[10px] text-ink-500 leading-tight mt-0.5">
                            {perm.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Ativo */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 text-iane-600 rounded border-ink-300 focus:ring-iane-500"
                />
                <label htmlFor="userActiveCheck" className="text-xs font-semibold text-ink-700 cursor-pointer">
                  Usuário Ativo (permite realizar login no sistema)
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-ink-300 rounded-lg text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-5 py-2 bg-iane-600 hover:bg-iane-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {isSubmittingUser ? 'Salvando...' : userToEdit ? 'Atualizar Usuário' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmação reforçada para zerar dados */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-rose-200">
            <div className="px-5 py-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-sm">Confirmar limpeza total</h3>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="text-rose-100 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 leading-relaxed">
                Esta ação remove permanentemente todos os aparelhos, linhas, colaboradores, movimentações, termos e registros de auditoria.
                Ela não pode ser desfeita. Gere e baixe um backup antes de continuar.
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetAcknowledged}
                  onChange={(e) => setResetAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-ink-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-xs text-ink-700 leading-snug">
                  Entendo que todos os dados serão apagados definitivamente.
                </span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Digite <span className="font-mono text-rose-700">ZERAR</span> para confirmar
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="ZERAR"
                  autoComplete="off"
                  className="w-full text-xs px-3 py-2 border border-ink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResetting}
                  className="px-4 py-2 border border-ink-300 rounded-lg text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmReset()}
                  disabled={
                    isResetting ||
                    !resetAcknowledged ||
                    resetConfirmText.trim().toUpperCase() !== 'ZERAR'
                  }
                  className="px-5 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  <span>{isResetting ? 'Zerando...' : 'Zerar todos os dados'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
