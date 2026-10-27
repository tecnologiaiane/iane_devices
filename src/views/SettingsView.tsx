import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataStorage';
import { authService } from '../services/authService';
import { User, UserRole, SystemUserFormData } from '../types';
import {
  Settings,
  FileSpreadsheet,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Database,
  History,
  CheckCircle2,
  AlertTriangle,
  Server,
  Activity,
  Terminal,
  UserPlus,
  Users,
  Edit2,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
  X,
  Lock,
  CheckSquare,
  Square
} from 'lucide-react';

interface SettingsViewProps {
  onOpenSpreadsheetModal: () => void;
  onDataReset: () => void;
  currentUser?: User | null;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'dashboard', label: 'Dashboard & Indicadores', description: 'Visualizar painel geral e métricas de telefonia' },
  { id: 'dispositivos', label: 'Dispositivos (Visualização)', description: 'Consultar inventário de smartphones e patrimônio' },
  { id: 'dispositivos_edit', label: 'Dispositivos (Cadastro/Edição)', description: 'Cadastrar novos aparelhos e alterar dados técnicos' },
  { id: 'linhas', label: 'Linhas Telefônicas (Visualização)', description: 'Consultar lista de chips, linhas e operadoras' },
  { id: 'linhas_edit', label: 'Linhas (Cadastro/Edição)', description: 'Cadastrar e alterar números, planos e custos' },
  { id: 'colaboradores', label: 'Colaboradores (Visualização)', description: 'Consultar colaboradores e departamentos' },
  { id: 'colaboradores_edit', label: 'Colaboradores (Cadastro/Edição)', description: 'Cadastrar novos colaboradores e matrículas' },
  { id: 'movimentacoes', label: 'Movimentações Patrimoniais', description: 'Executar fluxos de entrega, devolução, transferência e troca' },
  { id: 'termos', label: 'Termos e Documentos', description: 'Emitir, imprimir e assinar termos de custódia' },
  { id: 'relatorios', label: 'Relatórios & Exportações', description: 'Acessar relatórios analíticos e exportar dados' },
  { id: 'configuracoes', label: 'Configurações & Backup', description: 'Acessar tela de configurações e cópias de segurança' },
  { id: 'manage_users', label: 'Gerenciar Usuários (RBAC)', description: 'Criar, editar e excluir operadores e definir permissões (Super Admin)' },
];

const DEFAULT_ROLE_PERMS: Record<UserRole, string[]> = {
  admin: ['all', 'dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'termos', 'relatorios', 'configuracoes', 'manage_users'],
  gestor: ['dashboard', 'dispositivos', 'dispositivos_edit', 'linhas', 'linhas_edit', 'colaboradores', 'colaboradores_edit', 'movimentacoes', 'termos', 'relatorios', 'configuracoes'],
  operador: ['dashboard', 'dispositivos', 'linhas', 'colaboradores', 'movimentacoes', 'termos'],
  visualizador: ['dashboard', 'dispositivos', 'linhas', 'colaboradores', 'relatorios'],
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenSpreadsheetModal,
  onDataReset,
  currentUser: propUser,
}) => {
  const activeUser = propUser || authService.getCurrentUser();
  const canManageUsers = authService.canManageUsers(activeUser);

  const [auditLogs, setAuditLogs] = useState(dataService.getAuditLogs());
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [serverHealth, setServerHealth] = useState<{
    database: string;
    environment: string;
  } | null>(null);

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

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const list = await dataService.getUsers();
      setUsers(list);
    } catch {
      // ignore
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setServerHealth(data))
      .catch(() => setServerHealth({ database: 'local_storage_mode', environment: 'client' }));

    loadUsers();
  }, []);

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
    setFormPassword(''); // Em branco = manter atual
    setFormRole(u.role);
    setFormPermissions(u.permissions || DEFAULT_ROLE_PERMS[u.role] || []);
    setFormActive(u.active !== false);
    setShowPassword(false);
    setIsUserModalOpen(true);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setFormRole(newRole);
    // Se o usuário estiver criando um novo, preenche com as permissões padrão do papel
    if (!userToEdit) {
      setFormPermissions(DEFAULT_ROLE_PERMS[newRole] || []);
    }
  };

  const handleTogglePermission = (permId: string) => {
    if (formPermissions.includes(permId)) {
      setFormPermissions(formPermissions.filter(p => p !== permId));
    } else {
      setFormPermissions([...formPermissions, permId]);
    }
  };

  const handleSelectAllPerms = () => {
    setFormPermissions(AVAILABLE_PERMISSIONS.map(p => p.id));
  };

  const handleClearAllPerms = () => {
    setFormPermissions([]);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim() || !formUsername.trim()) {
      setErrorMessage('Nome completo e nome de usuário são obrigatórios.');
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
      username: formUsername.trim().toLowerCase(),
      email: formEmail.trim() || undefined,
      password: formPassword.trim() || undefined,
      role: formRole,
      permissions: formRole === 'admin' ? ['all', ...formPermissions] : formPermissions,
      active: formActive,
    };

    const res = await dataService.saveUser(payload);
    setIsSubmittingUser(false);

    if (res.success) {
      setSuccessMessage(res.message);
      setIsUserModalOpen(false);
      loadUsers();
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
        loadUsers();
        setAuditLogs(dataService.getAuditLogs());
      } else {
        setErrorMessage(res.message);
      }
    }
  };

  const handleDownloadBackup = () => {
    const json = dataService.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_iane_dispositivos_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
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
  };

  const handleClearDatabase = () => {
    if (window.confirm('Atenção: Isso removerá todos os dados (aparelhos, linhas, colaboradores e movimentações), deixando o sistema 100% limpo para produção. Deseja continuar?')) {
      dataService.resetToDefaults();
      setAuditLogs(dataService.getAuditLogs());
      setSuccessMessage('Base de dados zerada com sucesso. O sistema está limpo para inserção de dados reais.');
      onDataReset();
    }
  };

  return (
    <div className="space-y-6">
      {/* Mensagens de Feedback */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
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
          <button onClick={() => setErrorMessage('')} className="text-rose-700 hover:text-rose-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Production Architecture & PostgreSQL Status */}
      <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Servidor On-Premise & Conexão PostgreSQL</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Pronto para Produção
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Backend Express (`server.ts`), Criptografia bcrypt e Controle de Acesso por Perfil (RBAC)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
            <div className={`w-2.5 h-2.5 rounded-full ${serverHealth?.database === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300 font-medium">Status do Banco:</span>
            <span className={`font-semibold ${serverHealth?.database === 'connected' ? 'text-emerald-400' : 'text-amber-300'}`}>
              {serverHealth?.database === 'connected' ? 'PostgreSQL Conectado' : 'Modo Híbrido (Armazenamento Local/Memória)'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-2 font-semibold text-white mb-1">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>1. Base Compartilhada</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Todos os computadores da empresa conectam na mesma base de dados através da API REST corporativa.
            </p>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-2 font-semibold text-white mb-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Senhas Seguras (bcrypt)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Senhas criptografadas com salting (bcrypt 10 rounds). Nenhuma senha em texto puro é gravada.
            </p>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/60">
            <div className="flex items-center gap-2 font-semibold text-white mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>3. Permissões Granulares</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Super Admin define exatamente quais módulos cada operador pode visualizar, editar ou movimentar.
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          GESTÃO DE USUÁRIOS E PERMISSÕES (RBAC - EXCLUSIVO SUPER ADMIN / GESTORES)
          ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Gestão de Usuários & Permissões de Acesso</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                  {users.length} cadastrados
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Cadastre operadores e defina permissões específicas por módulo do sistema
              </p>
            </div>
          </div>

          {canManageUsers && (
            <button
              onClick={handleOpenCreateUser}
              className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Novo Usuário</span>
            </button>
          )}
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">Nome & Login</th>
                <th className="py-3 px-4">E-mail Corporativo</th>
                <th className="py-3 px-4">Papel (Perfil)</th>
                <th className="py-3 px-4">Módulos Autorizados</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingUsers ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Carregando usuários do sistema...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
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
                    gestor: 'bg-blue-100 text-blue-800 border-blue-200',
                    operador: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    visualizador: 'bg-slate-100 text-slate-700 border-slate-200',
                  }[u.role] || 'bg-slate-100 text-slate-700';

                  const roleLabel = {
                    admin: 'Super Administrador',
                    gestor: 'Gestor de Telefonia',
                    operador: 'Operador de TI/RH',
                    visualizador: 'Visualizador (Leitura)',
                  }[u.role] || u.role;

                  const hasAll = isAdminUser || u.permissions?.includes('all');
                  const countPerms = hasAll ? AVAILABLE_PERMISSIONS.length : (u.permissions?.length || 0);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{u.fullName}</span>
                          {isMyself && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded font-normal">
                              Você
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {u.email || <span className="text-slate-400 italic">Não informado</span>}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${roleBadgeClass}`}>
                          {roleLabel}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-slate-700 font-medium">
                          {hasAll ? (
                            <span className="text-emerald-700 font-semibold">Acesso Total ({AVAILABLE_PERMISSIONS.length} módulos)</span>
                          ) : (
                            `${countPerms} de ${AVAILABLE_PERMISSIONS.length} módulos`
                          )}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${u.active !== false ? 'text-emerald-700' : 'text-slate-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${u.active !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          {u.active !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {canManageUsers ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              title="Editar Usuário e Permissões"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={isCurrentSuper || isMyself}
                              title={isCurrentSuper ? 'Super Admin principal não pode ser excluído' : isMyself ? 'Você não pode excluir seu próprio login' : 'Excluir Usuário'}
                              className={`p-1.5 rounded-md transition-colors ${
                                isCurrentSuper || isMyself
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Somente leitura</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid de Ferramentas Auxiliares */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Migração da Planilha Atual */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Assistente de Migração da Planilha Existente
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Importe os dados das abas <strong>Base de Dados</strong> e <strong>Analítico</strong>. O assistente analisa o cabeçalho das colunas, detecta números de telefone, fabricantes e valida IMEIs duplicados antes de confirmar a importação.
            </p>
          </div>

          <button
            onClick={onOpenSpreadsheetModal}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Abrir Mapeador de Planilha (CSV)</span>
          </button>
        </div>

        {/* 2. Backup & Restauração JSON */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <Database className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Backup e Restauração de Dados
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Exporte todos os registros do sistema (aparelhos, linhas, colaboradores, termos e movimentações) em arquivo JSON seguro para contingência ou restaure um backup anterior.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownloadBackup}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Baixar Backup</span>
            </button>

            <label className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>Restaurar Backup</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Limpeza Total da Base de Dados */}
      {canManageUsers && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900">Limpar Base de Dados (Zerar para Produção)</h3>
            </div>
            <button
              onClick={handleClearDatabase}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
            >
              Zerar Todos os Dados
            </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Remove os registros de aparelhos, linhas, colaboradores e movimentações tanto localmente quanto no PostgreSQL, deixando o sistema 100% limpo para inventário oficial da IANE.
          </p>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Trilha de Auditoria do Sistema</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {auditLogs.length} eventos registrados
          </span>
        </div>

        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Entidade</th>
                <th className="py-2.5 px-3">Identificador</th>
                <th className="py-2.5 px-3">Operação / Detalhes</th>
                <th className="py-2.5 px-3">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-2 px-3 font-semibold text-slate-800">{log.entityType}</td>
                  <td className="py-2 px-3 font-mono text-blue-700">{log.entityLabel}</td>
                  <td className="py-2 px-3 text-slate-700">{log.details}</td>
                  <td className="py-2 px-3 text-slate-500">{log.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MODAL DE CADASTRO / EDIÇÃO DE USUÁRIO (RBAC)
          ========================================================================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  {userToEdit ? 'Editar Usuário e Permissões' : 'Cadastrar Novo Operador'}
                </h3>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-5">
              {/* Dados Básicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo Silva"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome de Usuário (Login) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!userToEdit}
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="Ex: carlos.silva"
                    className={`w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      userToEdit ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="Ex: carlos.silva@iane.ind.br"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {userToEdit ? 'Nova Senha (deixe em branco p/ manter)' : 'Senha de Acesso (Mín. 6 chars) *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!userToEdit}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={userToEdit ? '••••••••' : 'Defina a senha'}
                      className="w-full text-xs px-3 py-2 pr-9 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Papel do Usuário */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Papel / Perfil de Acesso
                  </label>
                  <span className="text-[11px] text-slate-500">
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
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
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
                    <h4 className="text-xs font-bold text-slate-900">
                      Permissões por Módulo do Sistema
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Marque exatamente o que este usuário tem autorização para visualizar ou modificar
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllPerms}
                      className="text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      Marcar todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllPerms}
                      className="text-slate-500 hover:underline font-medium cursor-pointer"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
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
                            ? 'bg-blue-50/60 border-blue-200 cursor-pointer'
                            : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <div className="pt-0.5 shrink-0 text-blue-600">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 leading-tight">
                            {perm.label}
                          </div>
                          <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
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
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="userActiveCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Usuário Ativo (permite realizar login no sistema)
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {isSubmittingUser ? 'Salvando...' : userToEdit ? 'Atualizar Usuário' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
