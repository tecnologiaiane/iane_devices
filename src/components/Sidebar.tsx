import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Smartphone,
  PhoneCall,
  Users,
  ArrowLeftRight,
  FileText,
  BarChart3,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LogOut,
  UserRound,
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

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onToggleMobile: () => void;
  pendingTermsCount: number;
  maintenanceCount: number;
  currentUser?: UserType | null;
  onLogout?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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
  isCollapsed,
  onToggleCollapse,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu do usuário ao clicar fora ou pressionar Esc
  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUserMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  // Ao recolher/expandir a barra, evita deixar o menu flutuando fora de contexto
  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [isCollapsed]);

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

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    setIsUserMenuOpen(false);
    if (isOpenMobile) onToggleMobile();
  };

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
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-navy-900 text-ink-100 flex flex-col border-r border-navy-800 transition-[width,transform] duration-200 ease-in-out ${
          isCollapsed ? 'lg:w-[76px]' : 'lg:w-64'
        } ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* Controle de minimizar / expandir (desktop) */}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expandir menu lateral' : 'Minimizar menu lateral'}
          aria-label={isCollapsed ? 'Expandir menu lateral' : 'Minimizar menu lateral'}
          className="hidden lg:flex absolute -right-3 top-20 z-50 h-6 w-6 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 shadow-md hover:text-iane-600 hover:border-iane-300 transition-colors cursor-pointer"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Brand / Logo Area */}
        <div
          className={`h-16 px-4 flex items-center border-b border-navy-800/80 bg-navy-950/40 ${
            isCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
          }`}
        >
          <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'lg:gap-0' : ''}`}>
            <img
              src="/icone.png"
              alt="IANE"
              className="h-7 w-auto object-contain shrink-0 drop-shadow-md"
            />
            <div className={`flex flex-col min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
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
        <nav
          className={`flex-1 py-4 space-y-1 overflow-y-auto ${
            isCollapsed ? 'lg:px-2 px-3' : 'px-3'
          }`}
        >
          <div
            className={`px-3 pb-2 text-[10px] font-semibold text-ink-400 uppercase tracking-wider ${
              isCollapsed ? 'lg:hidden' : ''
            }`}
          >
            Menu principal
          </div>
          {isCollapsed && (
            <div className="hidden lg:block mx-auto mb-2 h-px w-6 bg-navy-800" aria-hidden="true" />
          )}

          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                title={isCollapsed ? `${item.label}${item.badge ? ` · ${item.badge}` : ''}` : undefined}
                aria-label={isCollapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative w-full flex items-center rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isCollapsed
                    ? 'lg:justify-center lg:px-0 lg:py-2.5 justify-between px-3 py-2.5'
                    : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-iane-600 text-white shadow-[inset_3px_0_0_var(--color-sun-400)] font-semibold'
                    : 'text-ink-300 hover:text-white hover:bg-navy-800/60'
                }`}
              >
                <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? 'lg:gap-0' : ''}`}>
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-ink-400 group-hover:text-ink-200'
                    }`}
                  />
                  <span className={`truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      item.badgeStyle || 'bg-navy-800 text-ink-100'
                    } ${isCollapsed ? 'lg:hidden' : ''}`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Indicador compacto de pendência quando minimizado */}
                {isCollapsed && item.badge && (
                  <span
                    className="hidden lg:block absolute right-1.5 top-1.5 w-1.5 h-1.5 rounded-full bg-sun-400"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* User / Org Footer */}
        <div
          ref={userMenuRef}
          className={`relative p-3.5 border-t border-navy-800/80 bg-navy-950/40 ${
            isCollapsed ? 'lg:px-2' : ''
          }`}
        >
          {/* Menu do usuário: perfil (futuro) e sair */}
          {isUserMenuOpen && (
            <div
              className={`absolute z-50 bottom-full mb-2 bg-white text-ink-900 rounded-xl border border-ink-200 shadow-xl overflow-hidden ${
                isCollapsed ? 'left-2 w-64' : 'left-3 right-3'
              }`}
              role="menu"
              aria-label="Opções do usuário"
            >
              <div className="px-3.5 py-3 bg-ink-50 border-b border-ink-100">
                <p className="text-xs font-bold text-ink-900 truncate">
                  {currentUser?.fullName || 'Gestor de Ativos'}
                </p>
                <p className="text-[11px] text-ink-500 truncate mt-0.5">
                  {currentUser?.email || currentUser?.username || 'tecnologia@iane.ind.br'}
                </p>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => setIsUserMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-medium text-ink-500 hover:bg-ink-50 transition-colors cursor-not-allowed"
                title="Disponível em uma próxima atualização"
              >
                <UserRound className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">Alterar informações do perfil</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-ink-100 text-ink-500 border border-ink-200">
                  Em breve
                </span>
              </button>

              {onLogout && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 border-t border-ink-100 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sair</span>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsUserMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            title={isCollapsed ? currentUser?.fullName || 'Usuário' : 'Abrir opções do usuário'}
            className={`w-full flex items-center rounded-lg p-1.5 hover:bg-navy-800/60 transition-colors cursor-pointer ${
              isCollapsed ? 'lg:justify-center' : 'gap-2.5'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-iane-800/60 border border-iane-600/50 flex items-center justify-center text-xs font-bold text-iane-200 shrink-0">
              {currentUser?.username?.slice(0, 2).toUpperCase() || 'TI'}
            </div>
            <div className={`flex flex-col min-w-0 text-left flex-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="text-xs font-semibold text-ink-200 truncate">
                {currentUser?.fullName || 'Gestor de Ativos'}
              </span>
              <span className="text-[10px] text-ink-400 truncate">
                {currentUser?.email || currentUser?.username || 'tecnologia@iane.ind.br'}
              </span>
            </div>
            <ChevronUp
              className={`w-3.5 h-3.5 shrink-0 text-ink-400 transition-transform ${
                isUserMenuOpen ? 'rotate-180' : ''
              } ${isCollapsed ? 'lg:hidden' : ''}`}
            />
          </button>
        </div>
      </aside>
    </>
  );
};
