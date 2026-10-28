import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './views/DashboardView';
import { DevicesView } from './views/DevicesView';
import { LinesView } from './views/LinesView';
import { CollaboratorsView } from './views/CollaboratorsView';
import { MovementsView } from './views/MovementsView';
import { TermsView } from './views/TermsView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';

import { MovementModal } from './components/modals/MovementModal';
import { DeviceModal } from './components/modals/DeviceModal';
import { LineModal } from './components/modals/LineModal';
import { CollaboratorModal } from './components/modals/CollaboratorModal';
import { TermViewerModal } from './components/modals/TermViewerModal';
import { SpreadsheetImportModal } from './components/modals/SpreadsheetImportModal';

import { Device, PhoneLine, Collaborator, DocumentTerm, MovementType, User } from './types';
import { dataService } from './services/dataStorage';
import { authService } from './services/authService';
import { apiClient, ApiNotification } from './services/apiClient';
import { LoginView } from './views/LoginView';

const tabToPath: Record<NavTab, string> = {
  dashboard: '/dashboard',
  dispositivos: '/dispositivos',
  linhas: '/linhas',
  colaboradores: '/colaboradores',
  movimentacoes: '/movimentacoes',
  termos: '/termos',
  relatorios: '/relatorios',
  configuracoes: '/configuracoes',
};

const pathToTab: Record<string, NavTab> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/dispositivos': 'dispositivos',
  '/linhas': 'linhas',
  '/colaboradores': 'colaboradores',
  '/movimentacoes': 'movimentacoes',
  '/termos': 'termos',
  '/relatorios': 'relatorios',
  '/configuracoes': 'configuracoes',
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [apiNotifications, setApiNotifications] = useState<ApiNotification[]>([]);

  // Notificações globais de erros HTTP e indisponibilidade do backend
  React.useEffect(() => {
    return apiClient.subscribeError((notif) => {
      // Token inválido/expirado: encerra a sessão para o usuário autenticar novamente
      if (notif.status === 401 && authService.getCurrentUser()) {
        authService.logout();
        setCurrentUser(null);
        return;
      }
      setApiNotifications((prev) => [notif, ...prev.slice(0, 2)]);
      setTimeout(() => {
        setApiNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      }, 7000);
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
      const perms = currentUser.permissions || ['all'];
      const hasPerm = currentUser.role === 'admin' || perms.includes('all') || perms.includes(activeTab);
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

  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceToEdit, setDeviceToEdit] = useState<Device | null>(null);

  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [lineToEdit, setLineToEdit] = useState<PhoneLine | null>(null);

  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [collaboratorToEdit, setCollaboratorToEdit] = useState<Collaborator | null>(null);

  const [isTermViewerOpen, setIsTermViewerOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<DocumentTerm | null>(null);

  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Quick Open Handlers
  const handleOpenMovementModal = (
    deviceId?: string,
    flow: 'entrega' | 'devolucao' | 'transferencia' | 'troca' = 'entrega',
    collaboratorId?: string
  ) => {
    setMovementPreselectDeviceId(deviceId);
    setMovementDefaultFlow(flow);
    setMovementPreselectCollaboratorId(collaboratorId);
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
    setIsTermViewerOpen(true);
  };

  const handleLogout = () => {
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
    <div className="min-h-screen bg-ink-50 text-ink-900 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpenMobile={isMobileMenuOpen}
        onToggleMobile={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        pendingTermsCount={metrics.pendingTermsCount}
        maintenanceCount={metrics.stockMaintenance}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          onToggleMobile={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenMovementModal={() => handleOpenMovementModal()}
          onOpenDeviceModal={() => handleOpenDeviceModal()}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              key={refreshKey}
              onNavigate={setActiveTab}
              onOpenMovementModal={() => handleOpenMovementModal()}
            />
          )}

          {activeTab === 'dispositivos' && (
            <DevicesView
              key={refreshKey}
              onOpenDeviceModal={handleOpenDeviceModal}
              onOpenMovementWithDevice={(deviceId, flow) => handleOpenMovementModal(deviceId, flow)}
              onViewTerm={handleViewTerm}
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
              onOpenMovementModal={() => handleOpenMovementModal()}
              onViewTerm={handleViewTerm}
            />
          )}

          {activeTab === 'termos' && (
            <TermsView
              key={refreshKey}
              onViewTerm={handleViewTerm}
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
              onOpenSpreadsheetModal={() => setIsSpreadsheetModalOpen(true)}
              onDataReset={triggerRefresh}
              currentUser={currentUser}
            />
          )}
        </main>
      </div>

      {/* Modals mounted at root level */}
      <MovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        onSuccess={triggerRefresh}
        preselectedDeviceId={movementPreselectDeviceId}
        preselectedCollaboratorId={movementPreselectCollaboratorId}
        defaultFlow={movementDefaultFlow}
      />

      <DeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        onSuccess={triggerRefresh}
        deviceToEdit={deviceToEdit}
      />

      <LineModal
        isOpen={isLineModalOpen}
        onClose={() => setIsLineModalOpen(false)}
        onSuccess={triggerRefresh}
        lineToEdit={lineToEdit}
      />

      <CollaboratorModal
        isOpen={isCollaboratorModalOpen}
        onClose={() => setIsCollaboratorModalOpen(false)}
        onSuccess={triggerRefresh}
        collaboratorToEdit={collaboratorToEdit}
      />

      <TermViewerModal
        isOpen={isTermViewerOpen}
        onClose={() => setIsTermViewerOpen(false)}
        term={selectedTerm}
        onTermUpdated={triggerRefresh}
      />

      <SpreadsheetImportModal
        isOpen={isSpreadsheetModalOpen}
        onClose={() => setIsSpreadsheetModalOpen(false)}
        onSuccess={triggerRefresh}
      />

      {/* Notificações Flutuantes Globais do ApiClient (401, 403, 500, Servidor Indisponível) */}
      <aside aria-label="Notificações do Sistema" className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {apiNotifications.map((notif) => (
          <div
            key={notif.id}
            role="alert"
            className={`pointer-events-auto p-4 rounded-xl shadow-xl border backdrop-blur-md flex items-start justify-between gap-3 transition-all duration-300 ${
              notif.type === 'error'
                ? 'bg-rose-950/95 border-rose-700 text-rose-100 shadow-rose-950/40'
                : 'bg-navy-950/95 border-gold-700 text-sun-100 shadow-navy-950/40'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-base select-none mt-0.5">⚠️</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold leading-tight">{notif.title}</p>
                  {notif.status ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-rose-300">
                      HTTP {notif.status}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] opacity-90 mt-1 leading-snug">{notif.message}</p>
                <span className="text-[9px] opacity-60 block mt-1">{notif.timestamp}</span>
              </div>
            </div>
            <button
              onClick={() => setApiNotifications((prev) => prev.filter((n) => n.id !== notif.id))}
              className="text-white/60 hover:text-white shrink-0 cursor-pointer p-1 rounded hover:bg-white/10"
              title="Fechar notificação"
            >
              ✕
            </button>
          </div>
        ))}
      </aside>
    </div>
  );
}
