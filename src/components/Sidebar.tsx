import React from 'react';
import {
  LayoutDashboard,
  Smartphone,
  PhoneCall,
  Users,
  ArrowLeftRight,
  FileText,
  BarChart3,
  Settings,
  ShieldCheck,
  Menu,
  X,
  FileSpreadsheet
} from 'lucide-react';

export type NavTab = 
  | 'dashboard' 
  | 'dispositivos' 
  | 'linhas' 
  | 'colaboradores' 
  | 'movimentacoes' 
  | 'termos' 
  | 'relatorios' 
  | 'configuracoes';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onToggleMobile: () => void;
  pendingTermsCount: number;
  maintenanceCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onToggleMobile,
  pendingTermsCount,
  maintenanceCount,
}) => {
  const menuItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'dispositivos' as NavTab,
      label: 'Dispositivos',
      icon: Smartphone,
      badge: maintenanceCount > 0 ? `${maintenanceCount} manut.` : null,
      badgeStyle: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'linhas' as NavTab,
      label: 'Linhas telefônicas',
      icon: PhoneCall,
      badge: null,
    },
    {
      id: 'colaboradores' as NavTab,
      label: 'Colaboradores',
      icon: Users,
      badge: null,
    },
    {
      id: 'movimentacoes' as NavTab,
      label: 'Movimentações',
      icon: ArrowLeftRight,
      badge: null,
    },
    {
      id: 'termos' as NavTab,
      label: 'Termos e documentos',
      icon: FileText,
      badge: pendingTermsCount > 0 ? `${pendingTermsCount} pend.` : null,
      badgeStyle: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'relatorios' as NavTab,
      label: 'Relatórios',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'configuracoes' as NavTab,
      label: 'Configurações',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={onToggleMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo Area */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight text-white leading-tight">
                TelecomAsset Pro
              </span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Gestão Patrimonial
              </span>
            </div>
          </div>
          <button
            onClick={onToggleMobile}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-md"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Menu Principal
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (isOpenMobile) onToggleMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      item.badgeStyle || 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Spreadsheet Migration Callout */}
        <div className="p-3 mx-3 mb-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs">
          <div className="flex items-center gap-2 font-medium text-slate-200 mb-1">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Migração de Planilha</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2.5">
            Importe as abas Analítico e Base de Dados com validação automática de IMEIs.
          </p>
          <button
            onClick={() => {
              onSelectTab('configuracoes');
              if (isOpenMobile) onToggleMobile();
            }}
            className="w-full py-1.5 px-2 bg-slate-700/80 hover:bg-slate-700 text-white rounded-md text-[11px] font-medium transition-colors text-center"
          >
            Abrir Importador CSV
          </button>
        </div>

        {/* User / Org Footer */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/30 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
            TI
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-slate-200 truncate">
              Gestão de Ativos & TI
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              tecnologia@iane.ind.br
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
