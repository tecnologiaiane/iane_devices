import React, { useState, useEffect, useRef } from 'react';
import { dataService } from '../services/dataStorage';
import { authService } from '../services/authService';
import { apiClient } from '../services/apiClient';
import { User, UserRole, SystemUserFormData, CatalogItem, Catalogs, CatalogType } from '../types';
import { Modal } from '../components/Modal';
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
  <section className="bg-surface rounded-xl border border-line shadow-xs overflow-hidden">
    <button
      type="button"
      onClick={() => onToggle(id)}
      aria-expanded={isOpen}
      aria-controls={`settings-section-${id}`}
      className="w-full flex items-center gap-3 p-4 text-left hover:bg-subtle/60 transition-colors cursor-pointer"
    >
      <div
        className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
          tone === 'danger'
            ? 'bg-danger-bg border-danger-bd text-danger-fg'
            : 'bg-info-bg border-info-bd text-accent'
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-text truncate">{title}</h3>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-subtle text-muted border border-line shrink-0">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted truncate mt-0.5">{description}</p>
      </div>

      <ChevronDown
        className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>

    {isOpen && (
      <div id={`settings-section-${id}`} className="border-t border-line">
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
        <div className="p-4 bg-ok-bg border border-ok-bd rounded-xl text-xs text-ok-fg flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-ok-fg shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-ok-fg hover:text-ok-fg cursor-pointer" aria-label="Fechar mensagem">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-danger-bg border border-danger-bd rounded-xl text-xs text-danger-fg flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger-fg shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-danger-fg hover:text-danger-fg cursor-pointer" aria-label="Fechar mensagem">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cabeçalho da tela + status do banco em dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-text">Configurações e administração</h2>
          <p className="text-xs text-muted mt-0.5">
            Cadastros, backup, usuários e auditoria organizados em seções recolhíveis.
          </p>
        </div>

        <div ref={dbDropdownRef} className="relative self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsDbDropdownOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isDbDropdownOpen}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-line text-xs font-semibold text-text shadow-xs hover:bg-subtle transition-colors cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                dbConnected ? 'bg-ok-fg' : dbUnreachable ? 'bg-danger-fg' : 'bg-amber-500'
              }`}
            />
            <span>{dbLabel}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted transition-transform ${
                isDbDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isDbDropdownOpen && (
            <div
              role="menu"
              aria-label="Status da conexão com o banco"
              className="absolute right-0 mt-2 w-72 bg-surface rounded-xl border border-line shadow-xl z-50 overflow-hidden"
            >
              <div className="flex items-start gap-2.5 p-3.5">
                <div
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                    dbConnected
                      ? 'bg-ok-bg border-ok-bd text-ok-fg'
                      : dbUnreachable
                      ? 'bg-danger-bg border-danger-bd text-danger-fg'
                      : 'bg-amber-50 border-amber-200 text-amber-600'
                  }`}
                >
                  {dbConnected ? <Server className="w-4 h-4" /> : <ServerOff className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text">
                    {dbConnected ? 'PostgreSQL conectado' : dbUnreachable ? 'Servidor sem resposta' : 'PostgreSQL desconectado'}
                  </p>
                  <p className="text-[11px] text-muted leading-snug mt-0.5">
                    {dbConnected
                      ? 'Leitura e gravação na base corporativa.'
                      : 'O sistema mantém os dados no cache local até reconectar.'}
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-2.5 border-t border-line space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Ambiente</span>
                  <span className="font-semibold text-text">
                    {serverHealth?.environment === 'production' ? 'Produção' : 'Desenvolvimento'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Última verificação</span>
                  <span className="font-mono text-text">
                    {lastHealthCheck ? lastHealthCheck.toLocaleTimeString('pt-BR') : '—'}
                  </span>
                </div>
              </div>

              <div className="p-2 border-t border-line flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void checkHealth()}
                  disabled={isCheckingHealth}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-text hover:bg-subtle transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  Verificar
                </button>
                <button
                  type="button"
                  onClick={() => void handleForceSyncWithDatabase()}
                  disabled={isSyncingWithDb || !dbConnected}
                  title="Grava os dados locais no PostgreSQL"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-accent hover:bg-info-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                <section key={type} className="rounded-lg border border-line p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-text">{catalogLabels[type]}</h3>
                    <span className="text-[10px] text-muted tabular-nums">{catalogs[type]?.length || 0} itens</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                    <input value={catalogSearch[type]} onChange={(event) => setCatalogSearch((current) => ({ ...current, [type]: event.target.value }))} placeholder={`Buscar em ${catalogLabels[type].toLowerCase()}...`} className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-8 pr-3 text-xs text-text focus:outline-none focus:ring-2 focus:ring-focus/40" />
                  </div>
                  {editingItem ? (
                    <form onSubmit={(event) => { event.preventDefault(); handleCatalogSubmit(type, editingItem); }} className="flex gap-2">
                      <input autoFocus value={catalogDraft[type]} onChange={(event) => setCatalogDraft((current) => ({ ...current, [type]: event.target.value }))} aria-label="Nome" placeholder="Nome" className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-focus/40" />
                      <button type="submit" disabled={savingCatalog === type} className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-on-accent hover:bg-accent/90 disabled:opacity-50"><Save className="h-3.5 w-3.5" />Salvar</button>
                      <button type="button" onClick={() => { setEditingCatalogItem(null); setCatalogDraft((current) => ({ ...current, [type]: '' })); }} className="rounded-lg bg-subtle px-3 py-2 text-xs font-medium text-text hover:bg-line">Cancelar</button>
                    </form>
                  ) : (
                    <form onSubmit={(event) => { event.preventDefault(); handleCatalogSubmit(type); }} className="flex gap-2">
                      <input value={catalogDraft[type]} onChange={(event) => setCatalogDraft((current) => ({ ...current, [type]: event.target.value }))} aria-label="Nome" placeholder="Nome" className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-focus/40" />
                      <button type="submit" disabled={savingCatalog === type} className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-on-accent hover:bg-accent/90 disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Adicionar</button>
                    </form>
                  )}
                  <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-md border border-line">
                    {visibleItems.length ? visibleItems.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 px-2.5 py-2 hover:bg-subtle/70">
                        <span className="min-w-0 flex-1 truncate text-xs text-text">{item.name}</span>
                        <button type="button" title="Editar" onClick={() => { setEditingCatalogItem({ type, id: item.id }); setCatalogDraft((current) => ({ ...current, [type]: item.name })); setErrorMessage(''); }} className="rounded p-1 text-muted hover:bg-info-bg hover:text-accent"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button type="button" title="Excluir" onClick={() => handleCatalogDelete(type, item)} className="rounded p-1 text-muted hover:bg-danger-bg hover:text-danger-fg"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    )) : <li className="px-3 py-4 text-center text-[11px] text-muted">{query ? 'Nenhum resultado.' : 'Nenhum item cadastrado.'}</li>}
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
              <p className="text-xs text-muted">
                Controle de acesso baseado em perfis (RBAC). Apenas administradores e gestores autorizados podem alterar usuários.
              </p>
              <button
                onClick={handleOpenCreateUser}
                className="py-2 px-3.5 bg-accent hover:bg-accent/90 text-on-accent rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Novo Usuário</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-line rounded-lg">
              <table className="ds-table">
                <thead className="bg-subtle text-muted font-semibold border-b border-line text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Nome & Login</th>
                    <th className="py-3 px-4">E-mail Corporativo</th>
                    <th className="py-3 px-4">Papel (Perfil)</th>
                    <th className="py-3 px-4">Módulos Autorizados</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted">
                        Carregando usuários do sistema...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted">
                        Nenhum usuário cadastrado.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isAdminUser = u.role === 'admin';
                      const isCurrentSuper = u.id === 'user-iane-super-1' || u.id === 'user-iane-super-2';
                      const isMyself = u.id === activeUser?.id;

                      const roleBadgeClass = {
                        admin: 'bg-info-bg text-info-fg border-info-bd',
                        gestor: 'bg-subtle text-accent border-info-bd',
                        operador: 'bg-ok-bg text-ok-fg border-ok-bd',
                        visualizador: 'bg-subtle text-text border-line',
                      }[u.role] || 'bg-subtle text-text';

                      const roleLabel = {
                        admin: 'Super Administrador',
                        gestor: 'Gestor de Telefonia',
                        operador: 'Operador de TI/RH',
                        visualizador: 'Visualizador (Leitura)',
                      }[u.role] || u.role;

                      const hasAll = isAdminUser || u.permissions?.includes('all');
                      const countPerms = hasAll ? AVAILABLE_PERMISSIONS.length : (u.permissions?.length || 0);

                      return (
                        <tr key={u.id} className="hover:bg-subtle/60 transition-colors">
                          <td data-label="Nome & Login" className="py-3 px-4">
                            <div className="font-semibold text-text flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              {isMyself && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-info-bg text-accent border border-info-bd rounded font-normal">
                                  Você
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted font-mono">@{u.username}</div>
                          </td>

                          <td data-label="E-mail Corporativo" className="py-3 px-4 text-muted">
                            {u.email || <span className="text-muted italic">Não informado</span>}
                          </td>

                          <td data-label="Papel (Perfil)" className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${roleBadgeClass}`}>
                              {roleLabel}
                            </span>
                          </td>

                          <td data-label="Módulos Autorizados" className="py-3 px-4">
                            <span className="text-text font-medium">
                              {hasAll ? (
                                <span className="text-ok-fg font-semibold">Acesso Total ({AVAILABLE_PERMISSIONS.length} módulos)</span>
                              ) : (
                                `${countPerms} de ${AVAILABLE_PERMISSIONS.length} módulos`
                              )}
                            </span>
                          </td>

                          <td data-label="Status" className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${u.active !== false ? 'text-ok-fg' : 'text-muted'}`}>
                              <span className={`w-2 h-2 rounded-full ${u.active !== false ? 'bg-ok-fg' : 'bg-line-strong'}`} />
                              {u.active !== false ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>

                          <td data-label="Ações" className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                title="Editar Usuário e Permissões"
                                className="p-1.5 text-muted hover:text-accent hover:bg-info-bg rounded-md transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u)}
                                disabled={isCurrentSuper || isMyself}
                                title={isCurrentSuper ? 'Super Admin principal não pode ser excluído' : isMyself ? 'Você não pode excluir seu próprio login' : 'Excluir Usuário'}
                                className={`p-1.5 rounded-md transition-colors ${
                                  isCurrentSuper || isMyself
                                    ? 'text-muted cursor-not-allowed'
                                    : 'text-muted hover:text-danger-fg hover:bg-danger-bg cursor-pointer'
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
                  <div className="w-8 h-8 rounded-lg bg-ok-bg border border-ok-bd text-ok-fg flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text">Backup automático do PostgreSQL</p>
                    <p className="text-[11px] text-muted leading-snug mt-0.5">
                      Rotina no servidor, executada a cada {backupConfig.intervalHours} horas. Inclui os PDFs dos termos.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => void handleCreateBackup()}
                  disabled={isCreatingBackup || !dbConnected}
                  title={!dbConnected ? 'Conecte o PostgreSQL para gerar o backup' : 'Gerar uma cópia completa agora'}
                  className="py-2 px-3.5 bg-accent hover:bg-accent/90 text-on-accent rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isCreatingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  <span>{isCreatingBackup ? 'Gerando backup...' : 'Fazer backup agora'}</span>
                </button>
              </div>

              <div className="border border-line rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-subtle border-b border-line flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Cópias no servidor
                  </span>
                  <button
                    onClick={() => void loadBackups()}
                    disabled={loadingBackups}
                    title="Atualizar lista"
                    className="p-1 text-muted hover:text-accent rounded transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {loadingBackups && backups.length === 0 ? (
                  <p className="px-3 py-5 text-center text-[11px] text-muted">Carregando backups...</p>
                ) : backups.length === 0 ? (
                  <p className="px-3 py-5 text-center text-[11px] text-muted">
                    Nenhum backup ainda. A primeira cópia automática é criada após o servidor conectar ao banco.
                  </p>
                ) : (
                  <ul className="divide-y divide-line max-h-56 overflow-y-auto">
                    {backups.map((backup) => (
                      <li key={backup.fileName} className="flex items-center gap-3 px-3 py-2 hover:bg-subtle/60">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-text truncate">
                            {backup.origin === 'scheduled' ? 'Automático' : 'Manual'} · {formatBackupDate(backup.createdAt)}
                          </p>
                          <p className="text-[10px] font-mono text-muted truncate">
                            {backup.fileName} · {formatFileSize(backup.size)}
                          </p>
                        </div>
                        <button
                          onClick={() => void handleDownloadServerBackup(backup.fileName)}
                          disabled={downloadingBackup === backup.fileName}
                          title="Baixar este backup"
                          className="p-1.5 text-muted hover:text-accent hover:bg-info-bg rounded-md transition-colors disabled:opacity-50 cursor-pointer"
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
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-subtle border border-line">
              <ShieldAlert className="w-4 h-4 text-muted shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted leading-relaxed">
                O backup completo do servidor é exclusivo para administradores. Use a cópia local em JSON abaixo.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-line">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
              Cópia local em JSON
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDownloadLocalBackup}
                className="py-2 px-3 bg-subtle hover:bg-line text-text rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-muted" />
                <span>Baixar JSON</span>
              </button>

              <label className="py-2 px-3 bg-subtle hover:bg-line text-text rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-muted" />
                <span>Restaurar JSON</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
            <p className="text-[10px] text-muted leading-snug mt-2">
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
          <table className="ds-table">
            <thead className="bg-subtle border-b border-line text-muted font-semibold text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Entidade</th>
                <th className="py-2.5 px-3">Identificador</th>
                <th className="py-2.5 px-3">Operação / Detalhes</th>
                <th className="py-2.5 px-3">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    Nenhum evento registrado.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-subtle/50">
                    <td data-label="Data / Hora" className="py-2 px-3 font-mono text-muted whitespace-nowrap">{log.timestamp}</td>
                    <td data-label="Entidade" className="py-2 px-3 font-semibold text-text">{log.entityType}</td>
                    <td data-label="Identificador" className="py-2 px-3 font-mono text-accent">{log.entityLabel}</td>
                    <td data-label="Operação / Detalhes" className="py-2 px-3 text-text">{log.details}</td>
                    <td data-label="Usuário" className="py-2 px-3 text-muted">{log.user}</td>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-danger-bd bg-danger-bg/60">
              <div className="flex items-start gap-2.5">
                <RotateCcw className="w-4 h-4 text-danger-fg shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-danger-fg">Zerar todos os dados</p>
                  <p className="text-[11px] text-danger-fg leading-snug mt-0.5">
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
                className="px-3.5 py-1.5 text-xs font-semibold text-danger-fg bg-surface hover:bg-danger-bg border border-danger-bd rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
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
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={userToEdit ? 'Editar Usuário e Permissões' : 'Cadastrar Novo Operador'}
        subtitle="Defina os dados de acesso e as permissões por módulo."
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveUser} className="space-y-5">
              {/* Dados Básicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo Silva"
                    className="w-full text-xs px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-focus/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    Nome de Usuário (Login) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isAdmin}
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="Ex: carlos.silva"
                    className="w-full text-xs px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-focus/40 disabled:bg-subtle disabled:text-muted disabled:cursor-not-allowed"
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    {!isAdmin
                      ? 'Somente o Super Admin pode alterar o nome de login.'
                      : userToEdit
                        ? 'Pode ser alterado a qualquer momento. O novo login vale no próximo acesso.'
                        : 'Letras, números, ponto, hífen, underline ou @ (mínimo 3 caracteres).'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="Ex: carlos.silva@iane.ind.br"
                    className="w-full text-xs px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-focus/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text mb-1">
                    {userToEdit ? 'Nova Senha (deixe em branco p/ manter)' : 'Senha de Acesso (Mín. 6 chars) *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!userToEdit}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={userToEdit ? '••••••••' : 'Defina a senha'}
                      className="w-full text-xs px-3 py-2 pr-9 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-focus/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-muted"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Papel do Usuário */}
              <div className="p-4 bg-subtle border border-line rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text">
                    Papel / Perfil de Acesso
                  </label>
                  <span className="text-[11px] text-muted">
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
                            ? 'bg-accent text-on-accent border-accent shadow-xs'
                            : 'bg-surface text-text border-line hover:bg-subtle'
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
                    <h4 className="text-xs font-bold text-text">
                      Permissões por Módulo do Sistema
                    </h4>
                    <p className="text-[11px] text-muted">
                      Marque exatamente o que este usuário tem autorização para visualizar ou modificar
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllPerms}
                      className="text-accent hover:underline font-medium cursor-pointer"
                    >
                      Marcar todos
                    </button>
                    <span className="text-muted">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllPerms}
                      className="text-muted hover:underline font-medium cursor-pointer"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-line rounded-xl bg-subtle/50">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = formRole === 'admin' || formPermissions.includes(perm.id) || formPermissions.includes('all');
                    return (
                      <div
                        key={perm.id}
                        onClick={() => formRole !== 'admin' && handleTogglePermission(perm.id)}
                        className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition-colors ${
                          formRole === 'admin'
                            ? 'bg-info-bg/40 border-info-bd cursor-not-allowed opacity-90'
                            : isChecked
                            ? 'bg-info-bg/60 border-info-bd cursor-pointer'
                            : 'bg-surface border-line hover:bg-subtle cursor-pointer'
                        }`}
                      >
                        <div className="pt-0.5 shrink-0 text-accent">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-accent" />
                          ) : (
                            <Square className="w-4 h-4 text-muted" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-text leading-tight">
                            {perm.label}
                          </div>
                          <div className="text-[10px] text-muted leading-tight mt-0.5">
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
                  className="w-4 h-4 text-accent rounded border-line-strong focus:ring-focus/40"
                />
                <label htmlFor="userActiveCheck" className="text-xs font-semibold text-text cursor-pointer">
                  Usuário Ativo (permite realizar login no sistema)
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-line-strong rounded-lg text-xs font-semibold text-text hover:bg-subtle transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-5 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-on-accent rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {isSubmittingUser ? 'Salvando...' : userToEdit ? 'Atualizar Usuário' : 'Criar Usuário'}
                </button>
              </div>
        </form>
      </Modal>

      {/* Modal de confirmação reforçada para zerar dados */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => {
          if (!isResetting) setIsResetModalOpen(false);
        }}
        title="Confirmar limpeza total"
        subtitle="Esta ação não pode ser desfeita."
        maxWidth="lg"
      >
        <div className="space-y-4">
              <div className="p-3 rounded-lg bg-danger-bg border border-danger-bd text-[11px] text-danger-fg leading-relaxed">
                Esta ação remove permanentemente todos os aparelhos, linhas, colaboradores, movimentações, termos e registros de auditoria.
                Ela não pode ser desfeita. Gere e baixe um backup antes de continuar.
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetAcknowledged}
                  onChange={(e) => setResetAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-line-strong text-danger-fg focus:ring-danger-fg"
                />
                <span className="text-xs text-text leading-snug">
                  Entendo que todos os dados serão apagados definitivamente.
                </span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Digite <span className="font-mono text-danger-fg">ZERAR</span> para confirmar
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="ZERAR"
                  autoComplete="off"
                  className="w-full text-xs px-3 py-2 border border-line-strong bg-surface text-text rounded-md focus:outline-none focus:ring-2 focus:ring-danger-fg font-mono uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResetting}
                  className="px-4 py-2 border border-line-strong rounded-lg text-xs font-semibold text-text hover:bg-subtle transition-colors cursor-pointer"
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
                  className="px-5 py-2 bg-danger-fg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-danger-bg rounded-md text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  <span>{isResetting ? 'Zerando...' : 'Zerar todos os dados'}</span>
                </button>
              </div>
              </div>
      </Modal>
    </div>
  );
};
