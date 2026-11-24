import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sidebar, NavTab } from './components/Sidebar';
import { Device, PhoneLine, Collaborator, DocumentTerm, MovementType, RequestRecord, User } from './types';
import { dataService } from './services/dataStorage';
import { authService } from './services/authService';
import { apiClient } from './services/apiClient';
import { LoginView } from './views/LoginView';
import { canAccessRequests } from './config/requestAccess';
import { Menu } from 'lucide-react';

// Views e modais são carregados sob demanda (React.lazy): o bundle inicial fica
// pequeno e cada tela baixa seu próprio chunk somente quando é aberta.
const DashboardView = React.lazy(() =>
  import('./views/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const DevicesView = React.lazy(() =>
  import('./views/DevicesView').then((m) => ({ default: m.DevicesView }))
);
const LinesView = React.lazy(() =>
  import('./views/LinesView').then((m) => ({ default: m.LinesView }))
);
const CollaboratorsView = React.lazy(() =>
  import('./views/CollaboratorsView').then((m) => ({ default: m.CollaboratorsView }))
);
const MovementsView = React.lazy(() =>
  import('./views/MovementsView').then((m) => ({ default: m.MovementsView }))
);
const TermsView = React.lazy(() =>
  import('./views/TermsView').then((m) => ({ default: m.TermsView }))
);
const ReportsView = React.lazy(() =>
  import('./views/ReportsView').then((m) => ({ default: m.ReportsView }))
);
const SettingsView = React.lazy(() =>
  import('./views/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const RequestsView = React.lazy(() =>
  import('./views/RequestsView').then((m) => ({ default: m.RequestsView }))
);

const MovementModal = React.lazy(() =>
  import('./components/modals/MovementModal').then((m) => ({ default: m.MovementModal }))
);
const DeviceModal = React.lazy(() =>
  import('./components/modals/DeviceModal').then((m) => ({ default: m.DeviceModal }))
);
const LineModal = React.lazy(() =>
  import('./components/modals/LineModal').then((m) => ({ default: m.LineModal }))
);
const CollaboratorModal = React.lazy(() =>
  import('./components/modals/CollaboratorModal').then((m) => ({ default: m.CollaboratorModal }))
);
const TermViewerModal = React.lazy(() =>
  import('./components/modals/TermViewerModal').then((m) => ({ default: m.TermViewerModal }))
);

const ViewFallback: React.FC = () => (
  <div className="animate-pulse space-y-4" role="status" aria-label="Carregando…">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 radius-lg border border-border-subtle bg-surface-card p-4">
          <div className="h-3 w-24 rounded bg-surface-subtle" />
          <div className="mt-3 h-6 w-16 rounded bg-surface-subtle" />
        </div>
      ))}
    </div>
    <div className="radius-lg border border-border-subtle bg-surface-card p-4">
      <div className="h-3 w-32 rounded bg-surface-subtle" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-surface-subtle/70" />
        ))}
      </div>
    </div>
    <span className="sr-only">Carregando…</span>
  </div>
);

const tabToPath: Record<NavTab, string> = {
  dashboard: '/dashboard',
  dispositivos: '/dispositivos',
  linhas: '/linhas',
  colaboradores: '/colaboradores',
  movimentacoes: '/movimentacoes',
  solicitacoes: '/solicitacoes',
  termos: '/termos',
  relatorios: '/relatorios',
  configuracoes: '/configuracoes',
};

// Título exibido no topo de cada tela (sem barra fixa, apenas o nome da área)
const PAGE_TITLES: Record<NavTab, string> = {
  dashboard: 'Dashboard',
  dispositivos: 'Dispositivos',
  linhas: 'Linhas telefônicas',
  colaboradores: 'Colaboradores',
  movimentacoes: 'Movimentações',
  solicitacoes: 'Solicitações',
  termos: 'Termos e documentos',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações',
};

const pathToTab: Record<string, NavTab> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/dispositivos': 'dispositivos',
  '/linhas': 'linhas',
  '/colaboradores': 'colaboradores',
  '/movimentacoes': 'movimentacoes',
  '/solicitacoes': 'solicitacoes',
  '/termos': 'termos',
  '/relatorios': 'relatorios',
  '/configuracoes': 'configuracoes',
};

const SIDEBAR_COLLAPSED_KEY = 'iane_sidebar_collapsed_v1';
const THEME_KEY = 'iane_theme_v1';

type Theme = 'light' | 'dark';

const readSidebarCollapsed = (): boolean => {
  try {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) return stored === 'true';
  } catch {
    // Armazenamento indisponível: usa o padrão abaixo
  }
  // Sem preferência salva, telas estreitas começam com o menu compacto
  return typeof window !== 'undefined' && window.innerWidth < 1024;
};

const readTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Armazenamento indisponível: usa o padrão claro
  }
  // Padrão do produto continua sendo o fundo claro, independente do sistema.
  return 'light';
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const activeTab = pathToTab[normalizedPath] || 'dashboard';
  const setActiveTab = (tab: NavTab) => {
    navigate(tabToPath[tab]);
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(readSidebarCollapsed);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Armazenamento indisponível: o estado continua válido apenas nesta sessão
      }
      return next;
    });
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleCloseMobileNav = () => setIsMobileNavOpen(false);

  // Tema e largura do menu são preferências de interface controladas aqui.
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Armazenamento indisponível: o tema continua válido nesta sessão
    }
  }, [theme]);

  React.useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setIsMobileViewport(isMobile);
      if (!isMobile) setIsMobileNavOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    if (!isMobileNavOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileNavOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavOpen]);

  // Mantém o estado da aplicação sincronizado com alterações de sessão/perfil
  // (login, logout e edição do próprio nome de usuário).
  React.useEffect(() => {
    return authService.subscribe((user) => setCurrentUser(user));
  }, []);

  // Token inválido/expirado: encerra a sessão para o usuário autenticar novamente.
  // A exibição dos toasts ficou no ToastProvider; este efeito preserva apenas a lógica de 401.
  React.useEffect(() => {
    return apiClient.subscribeError((notif) => {
      if (notif.status !== 401 || !authService.getCurrentUser()) return;
      if (dataService.getPendingSyncCount() > 0) {
        if (
          !window.confirm(
            `Existem ${dataService.getPendingSyncCount()} gravação(ões) pendente(s) que ainda não foi(ram) confirmada(s) no servidor. ` +
              'Ao sair, elas serão descartadas. Deseja continuar?'
          )
        ) {
          return;
        }
        dataService.clearOutbox();
      }
      authService.logout({ revoke: false });
      setCurrentUser(null);
    });
  }, []);

  // Sincronização inicial com o banco PostgreSQL (somente com sessão autenticada)
  React.useEffect(() => {
    if (!currentUser) return;
    dataService.syncWithServer().then(() => setRefreshKey(k => k + 1));
  }, [currentUser]);

  // Rotas protegidas: sem sessão, manda para /login guardando o caminho de origem
  React.useEffect(() => {
    const isLoginPath = normalizedPath === '/login';
    if (!currentUser && !isLoginPath) {
      navigate('/login', { replace: true, state: { from: normalizedPath } });
    }
  }, [currentUser, normalizedPath, navigate]);

  // Usuário autenticado não deve permanecer na tela de login.
  // Também é aqui que o retorno ao caminho de origem acontece: navegar no handler
  // de login competia com este efeito (o redirect para /dashboard vencia a corrida).
  React.useEffect(() => {
    if (!currentUser || normalizedPath !== '/login') return;
    const from = (location.state as { from?: string } | null)?.from;
    const target = from && from !== '/login' && pathToTab[from] ? from : tabToPath.dashboard;
    navigate(target, { replace: true });
  }, [currentUser, normalizedPath, navigate, location.state]);

  // Normaliza a URL: raiz e caminhos desconhecidos redirecionam para a aba inicial
  React.useEffect(() => {
    if (!currentUser) return;
    if (normalizedPath === '/login') return;
    if (!pathToTab[normalizedPath] || normalizedPath === '/') {
      navigate(tabToPath.dashboard, { replace: true });
    }
  }, [currentUser, normalizedPath, navigate]);

  // Guarda de rota / permissão: se usuário não tem permissão para a aba ativa, redireciona para dashboard
  React.useEffect(() => {
    if (currentUser && activeTab !== 'dashboard') {
      const perms = currentUser.permissions || [];
      const hasPerm = activeTab === 'solicitacoes'
        ? canAccessRequests(currentUser.role)
        : currentUser.role === 'admin' || perms.includes('all') || perms.includes(activeTab);
      if (!hasPerm) {
        navigate(tabToPath.dashboard, { replace: true });
      }
    }
  }, [currentUser, activeTab, navigate]);

  // Modal States
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementPreselectDeviceId, setMovementPreselectDeviceId] = useState<string | undefined>();
  const [movementPreselectCollaboratorId, setMovementPreselectCollaboratorId] = useState<string | undefined>();
  const [movementDefaultFlow, setMovementDefaultFlow] = useState<'entrega' | 'devolucao' | 'transferencia' | 'troca'>('entrega');
  const [movementApprovalRequest, setMovementApprovalRequest] = useState<RequestRecord | null>(null);

  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceToEdit, setDeviceToEdit] = useState<Device | null>(null);

  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [lineToEdit, setLineToEdit] = useState<PhoneLine | null>(null);

  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [collaboratorToEdit, setCollaboratorToEdit] = useState<Collaborator | null>(null);

  const [isTermViewerOpen, setIsTermViewerOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<DocumentTerm | null>(null);
  const [autoPrintTerm, setAutoPrintTerm] = useState(false);

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Quick Open Handlers
  const handleOpenMovementModal = (
    deviceId?: string,
    flow: 'entrega' | 'devolucao' | 'transferencia' | 'troca' = 'entrega',
    collaboratorId?: string
  ) => {
    setMovementApprovalRequest(null);
    setMovementPreselectDeviceId(deviceId);
    setMovementDefaultFlow(flow);
    setMovementPreselectCollaboratorId(collaboratorId);
    setIsMovementModalOpen(true);
  };

  const handleApproveRequest = (request: RequestRecord) => {
    const flowByType = {
      Entrega: 'entrega',
      Devolução: 'devolucao',
      Transferência: 'transferencia',
      'Troca de Aparelho': 'troca',
    } as const;
    const data = request.data || {};
    let deviceId: string | undefined;
    let collaboratorId: string | undefined;
    if (request.type === 'Devolução') {
      deviceId = data.devices?.[0]?.id;
      collaboratorId = data.collaboratorId;
    } else if (request.type === 'Transferência') {
      deviceId = data.deviceId;
      collaboratorId = data.destinationCollaboratorId;
    } else if (request.type === 'Troca de Aparelho') {
      deviceId = data.oldDeviceId;
      collaboratorId = data.collaboratorId;
    } else {
      const cpf = String(data.cpf || '').replace(/\D/g, '');
      collaboratorId = dataService.getCollaborators().find((collaborator) =>
        cpf && String(collaborator.cpf || '').replace(/\D/g, '') === cpf
      )?.id;
    }
    setMovementApprovalRequest(request);
    setMovementPreselectDeviceId(deviceId);
    setMovementPreselectCollaboratorId(collaboratorId);
    setMovementDefaultFlow(flowByType[request.type]);
    setIsMovementModalOpen(true);
  };

  const handleOpenDeviceModal = (device?: Device) => {
    setDeviceToEdit(device || null);
    setIsDeviceModalOpen(true);
  };

  const handleOpenLineModal = (line?: PhoneLine) => {
    setLineToEdit(line || null);
    setIsLineModalOpen(true);
  };

  const handleOpenCollaboratorModal = (collab?: Collaborator) => {
    setCollaboratorToEdit(collab || null);
    setIsCollaboratorModalOpen(true);
  };

  const handleViewTerm = (term: DocumentTerm) => {
    setSelectedTerm(term);
    setAutoPrintTerm(false);
    setIsTermViewerOpen(true);
  };

  const handlePrintTerm = (term: DocumentTerm) => {
    setSelectedTerm(term);
    setAutoPrintTerm(true);
    setIsTermViewerOpen(true);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    if (dataService.getPendingSyncCount() > 0) {
      if (
        !window.confirm(
          `Existem ${dataService.getPendingSyncCount()} gravação(ões) pendente(s) que ainda não foi(ram) confirmada(s) no servidor. ` +
            'Ao sair, elas serão descartadas. Deseja continuar?'
        )
      ) {
        return;
      }
      dataService.clearOutbox();
    }
    authService.logout();
    setCurrentUser(null);
  };

  // Se não estiver logado, exibe a tela de login no modelo IANE
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          triggerRefresh();
          // O redirecionamento para o caminho de origem é feito pelo efeito de rota acima,
          // evitando duas navegações concorrentes no mesmo commit.
          dataService.syncWithServer().then(() => setRefreshKey(k => k + 1));
        }}
      />
    );
  }

  // Metrics for badges
  const metrics = dataService.getDashboardMetrics();

  return (
    <div
      className="min-h-screen bg-surface-canvas text-text-primary flex"
      style={{ '--sidebar-width': isSidebarCollapsed ? '76px' : '256px' } as React.CSSProperties}
    >
      {isMobileNavOpen && (
        <button
          type="button"
          aria-label="Fechar menu lateral"
          onClick={handleCloseMobileNav}
          className="fixed inset-0 z-40 bg-sidebar-overlay/60 backdrop-blur-sm md:hidden cursor-pointer"
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingTermsCount={metrics.pendingTermsCount}
        maintenanceCount={metrics.stockMaintenance}
        currentUser={currentUser}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isMobileViewport={isMobileViewport}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={handleCloseMobileNav}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-[padding] duration-200 md:pl-[var(--sidebar-width)]">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <div className="mb-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Abrir menu lateral"
              aria-expanded={isMobileNavOpen}
              className="md:hidden shrink-0 h-9 w-9 inline-flex items-center justify-center radius-base border border-border-subtle bg-surface-card text-text-primary hover:bg-surface-subtle cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-[-0.01em]">
              {PAGE_TITLES[activeTab]}
            </h1>
          </div>
          <React.Suspense fallback={<ViewFallback />}>
          {activeTab === 'dashboard' && (
            <DashboardView
              key={refreshKey}
              onNavigate={setActiveTab}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'dispositivos' && (
            <DevicesView
              key={refreshKey}
              onOpenDeviceModal={handleOpenDeviceModal}
              onViewTerm={handleViewTerm}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'linhas' && (
            <LinesView
              key={refreshKey}
              onOpenLineModal={handleOpenLineModal}
            />
          )}

          {activeTab === 'colaboradores' && (
            <CollaboratorsView
              key={refreshKey}
              onOpenCollaboratorModal={handleOpenCollaboratorModal}
              onViewTerm={handleViewTerm}
              onOpenMovementWithCollaborator={(collabId) => handleOpenMovementModal(undefined, 'entrega', collabId)}
            />
          )}

          {activeTab === 'movimentacoes' && (
            <MovementsView
              key={refreshKey}
              onOpenMovementModal={(flow) => handleOpenMovementModal(undefined, flow || 'entrega')}
              onViewTerm={handleViewTerm}
              currentUser={currentUser}
              onApproveRequest={handleApproveRequest}
            />
          )}

          {activeTab === 'solicitacoes' && canAccessRequests(currentUser.role) && (
            <RequestsView currentUser={currentUser} />
          )}

          {activeTab === 'termos' && (
            <TermsView
              key={refreshKey}
              onViewTerm={handleViewTerm}
              onPrintTerm={handlePrintTerm}
            />
          )}

          {activeTab === 'relatorios' && (
            <ReportsView
              key={refreshKey}
            />
          )}

          {activeTab === 'configuracoes' && (
            <SettingsView
              key={refreshKey}
              onDataReset={triggerRefresh}
              currentUser={currentUser}
            />
          )}
          </React.Suspense>
        </main>
      </div>

      {/* Modals mounted at root level (carregados somente quando abertos) */}
      <React.Suspense fallback={null}>
        {isMovementModalOpen && (
          <MovementModal
            isOpen={isMovementModalOpen}
            onClose={() => { setIsMovementModalOpen(false); setMovementApprovalRequest(null); }}
            onSuccess={triggerRefresh}
            preselectedDeviceId={movementPreselectDeviceId}
            preselectedCollaboratorId={movementPreselectCollaboratorId}
            defaultFlow={movementDefaultFlow}
            approvalRequest={movementApprovalRequest}
          />
        )}

        {isDeviceModalOpen && (
          <DeviceModal
            isOpen={isDeviceModalOpen}
            onClose={() => setIsDeviceModalOpen(false)}
            onSuccess={triggerRefresh}
            deviceToEdit={deviceToEdit}
          />
        )}

        {isLineModalOpen && (
          <LineModal
            isOpen={isLineModalOpen}
            onClose={() => setIsLineModalOpen(false)}
            onSuccess={triggerRefresh}
            lineToEdit={lineToEdit}
          />
        )}

        {isCollaboratorModalOpen && (
          <CollaboratorModal
            isOpen={isCollaboratorModalOpen}
            onClose={() => setIsCollaboratorModalOpen(false)}
            onSuccess={triggerRefresh}
            collaboratorToEdit={collaboratorToEdit}
          />
        )}

        {isTermViewerOpen && selectedTerm && (
          <TermViewerModal
            isOpen={isTermViewerOpen}
            onClose={() => {
              setIsTermViewerOpen(false);
              setAutoPrintTerm(false);
            }}
            term={selectedTerm}
            onTermUpdated={triggerRefresh}
            autoPrint={autoPrintTerm}
          />
        )}
      </React.Suspense>

      {/* Modal de confirmação de logout */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Confirmar saída">
          <div className="absolute inset-0 bg-brand-navy-dark/60 transition-opacity backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative bg-surface-card rounded-lg p-6 shadow-2xl max-w-sm w-full mx-4 border border-border-subtle">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Tem certeza que deseja sair?</h3>
            <p className="text-text-muted text-sm mb-6">
              Sua sessão será encerrada e você será redirecionado para a tela de login.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-text-primary bg-surface-subtle hover:bg-surface-subtle/80 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-blue-action hover:bg-brand-blue-action-hover rounded-lg transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
