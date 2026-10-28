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

import { User as UserType } from '../types';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onToggleMobile: () => void;
  pendingTermsCount: number;
  maintenanceCount: number;
  currentUser?: UserType | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onToggleMobile,
  pendingTermsCount,
  maintenanceCount,
  currentUser,
  onLogout,
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
      badgeStyle: 'bg-sun-400 text-navy-900',
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
      badgeStyle: 'bg-sun-400 text-navy-900',
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

  const userPerms = currentUser?.permissions || ['all'];
  const isAdmin = currentUser?.role === 'admin' || userPerms.includes('all');

  const visibleMenuItems = menuItems.filter((item) => {
    if (isAdmin) return true;
    return userPerms.includes(item.id);
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-navy-950/60 z-40 lg:hidden"
          onClick={onToggleMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-navy-900 text-ink-100 flex flex-col border-r border-navy-800 transition-transform duration-200 ease-in-out lg:tranink-x-0 ${
          isOpenMobile ? 'tranink-x-0' : '-tranink-x-full'
        }`}
      >
        {/* Brand / Logo Area */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-navy-800/80 bg-navy-950/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/image_7420eaef.png"
              alt="IANE"
              className="h-7 w-auto object-contain shrink-0 drop-shadow-md"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-white leading-tight truncate">
                IANE
              </span>
              <span className="text-[10px] text-sky font-semibold uppercase tracking-wider truncate">
                Gestão de Dispositivos
              </span>
            </div>
          </div>
          <button
            onClick={onToggleMobile}
            className="lg:hidden text-ink-400 hover:text-white p-1 rounded-md cursor-pointer"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
            Menu principal
          </div>
          {visibleMenuItems.map((item) => {
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
                    ? 'bg-iane-600 text-white shadow-[inset_3px_0_0_var(--color-sun-400)] font-semibold'
                    : 'text-ink-300 hover:text-white hover:bg-navy-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-white' : 'text-ink-400 group-hover:text-ink-200'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      item.badgeStyle || 'bg-navy-800 text-ink-100'
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
        <div className="p-3 mx-3 mb-3 bg-navy-800/60 border border-navy-700/60 rounded-xl text-xs">
          <div className="flex items-center gap-2 font-medium text-ink-200 mb-1">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Migração de planilha</span>
          </div>
          <p className="text-[11px] text-ink-400 leading-relaxed mb-2.5">
            Importe as abas Analítico e Base de Dados com validação automática de IMEIs.
          </p>
          <button
            onClick={() => {
              onSelectTab('configuracoes');
              if (isOpenMobile) onToggleMobile();
            }}
            className="w-full py-1.5 px-2 bg-iane-600 hover:bg-iane-700 text-white rounded-md text-[11px] font-medium transition-colors text-center"
          >
            Abrir importador CSV
          </button>
        </div>

        {/* User / Org Footer */}
        <div className="p-3.5 border-t border-navy-800/80 bg-navy-950/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-iane-800/60 border border-iane-600/50 flex items-center justify-center text-xs font-bold text-iane-200 shrink-0">
              {currentUser?.username?.slice(0, 2).toUpperCase() || 'TI'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-ink-200 truncate">
                {currentUser?.fullName || 'Gestor de Ativos'}
              </span>
              <span className="text-[10px] text-ink-400 truncate">
                {currentUser?.email || 'tecnologia@iane.ind.br'}
              </span>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sair do sistema"
              className="p-1.5 rounded-lg text-ink-400 hover:text-rose-400 hover:bg-navy-800 transition-colors cursor-pointer"
              aria-label="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
