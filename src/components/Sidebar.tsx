import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Smartphone,
  PhoneCall,
  Users,
  ArrowLeftRight,
  ClipboardList,
  FileText,
  BarChart3,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LogOut,
  UserRound,
  Search,
  Megaphone,
  Sparkles,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from '../design-system/theme-provider';

export type NavTab =
  | 'dashboard'
  | 'dispositivos'
  | 'linhas'
  | 'colaboradores'
  | 'movimentacoes'
  | 'solicitacoes'
  | 'termos'
  | 'relatorios'
  | 'configuracoes';

import { User as UserType } from '../types';
import { canAccessRequests } from '../config/requestAccess';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingTermsCount: number;
  maintenanceCount: number;
  currentUser?: UserType | null;
  onLogout?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor de Telefonia',
  operador: 'Operador de TI/RH',
  visualizador: 'Visualizador',
};

const NOVIDADES = [
  'Menu lateral fixo, com busca rápida entre os módulos.',
  'Configurações organizadas em seções recolhíveis.',
  'Backup automático do banco com cópias para download.',
];

/** Remove acentos e caixa para a busca do menu */
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function Sidebar({
  activeTab,
  onSelectTab,
  pendingTermsCount,
  maintenanceCount,
  currentUser,
  onLogout,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const userMenuRef = useRef<HTMLDivElement>(null);
  const newsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const shouldFocusSearchRef = useRef(false);

  const isExpanded = !isCollapsed;

  // Fecha os popovers ao clicar fora ou pressionar Esc
  useEffect(() => {
    if (!isUserMenuOpen && !isNewsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
      if (newsRef.current && !newsRef.current.contains(target)) {
        setIsNewsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsNewsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen, isNewsOpen]);

  // Ao recolher a barra, fecha popovers e limpa a busca
  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsNewsOpen(false);
    if (isCollapsed) setSearchTerm('');
  }, [isCollapsed]);

  // Foca a busca depois que a barra é expandida pelo ícone de pesquisa
  useEffect(() => {
    if (isExpanded && shouldFocusSearchRef.current) {
      shouldFocusSearchRef.current = false;
      searchInputRef.current?.focus();
    }
  }, [isExpanded]);

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'dispositivos',
      label: 'Dispositivos',
      icon: Smartphone,
      badge: maintenanceCount,
    },
    { id: 'linhas', label: 'Linhas telefônicas', icon: PhoneCall },
    { id: 'colaboradores', label: 'Colaboradores', icon: Users },
    { id: 'movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
    { id: 'solicitacoes', label: 'Solicitações', icon: ClipboardList },
    {
      id: 'termos',
      label: 'Termos e documentos',
      icon: FileText,
      badge: pendingTermsCount,
    },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const userPerms = currentUser?.permissions || [];
  const isAdmin = currentUser?.role === 'admin' || userPerms.includes('all');

  const permittedItems = navItems.filter((item) =>
    item.id === 'solicitacoes'
      ? canAccessRequests(currentUser?.role)
      : isAdmin || userPerms.includes(item.id)
  );

  const term = normalize(searchTerm);
  const filteredItems = term
    ? permittedItems.filter((item) => normalize(item.label).includes(term))
    : permittedItems;

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    setIsUserMenuOpen(false);
    setIsNewsOpen(false);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (filteredItems.length > 0) handleSelect(filteredItems[0].id);
  };

  const handleExpandForSearch = () => {
    shouldFocusSearchRef.current = true;
    onToggleCollapse();
  };

  const userFullName = currentUser?.fullName || 'Gestor de Ativos';
  const userEmail = currentUser?.email || currentUser?.username || 'tecnologia@iane.ind.br';
  const userRole = ROLE_LABELS[currentUser?.role || ''] || currentUser?.role || 'Usuário';
  const initials = (currentUser?.username || 'TI').slice(0, 2).toUpperCase();

  return (
    <>
      {/* Sidebar fixa (sempre visível) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-navy-900 text-white/90 flex flex-col border-r border-navy-800 transition-[width] duration-200 ease-in-out ${
          isExpanded ? 'w-64' : 'w-[76px]'
        }`}
      >
        {/* Controle de minimizar / expandir */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
          aria-label={isExpanded ? 'Recolher menu lateral' : 'Expandir menu lateral'}
          className="flex absolute -right-3 top-24 z-50 h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-md hover:text-accent hover:border-accent transition-colors cursor-pointer"
        >
          {isExpanded ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Marca */}
        <div
          className={`h-16 flex items-center ${
            isExpanded ? 'px-4 gap-2.5' : 'justify-center px-2'
          }`}
        >
          <img src="/logo.png" alt="IANE" className="h-8 w-auto object-contain shrink-0" />
          {isExpanded && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-white leading-tight truncate">
                IANE
              </span>
              <span className="text-[9px] text-sky font-semibold uppercase tracking-[0.14em] truncate">
                Gestão de Dispositivos
              </span>
            </div>
          )}
        </div>

        {/* Busca no menu */}
        <div className={`pb-2 ${isExpanded ? 'px-4' : 'px-2'}`}>
          {isExpanded ? (
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar..."
                aria-label="Buscar item do menu"
                className="h-9 w-full rounded-md bg-surface pl-9 pr-3 text-xs text-text placeholder:text-muted outline-none border border-transparent focus:border-accent focus:ring-2 focus:ring-focus/30 transition [&::-webkit-search-cancel-button]:hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted hover:text-text cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </form>
          ) : (
            <button
              type="button"
              onClick={handleExpandForSearch}
              title="Buscar no menu"
              aria-label="Buscar no menu"
              className="mx-auto h-9 w-9 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-navy-800 transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navegação */}
        <nav
          aria-label="Menu principal"
          className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${isExpanded ? 'px-3' : 'px-2'}`}
        >
          <div className={isExpanded ? 'space-y-2.5' : 'space-y-2'}>
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const badge = item.badge && item.badge > 0 ? item.badge : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  title={isExpanded ? undefined : item.label}
                  aria-label={isExpanded ? undefined : item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative w-full h-11 flex items-center rounded-lg text-[13px] transition-colors cursor-pointer ${
                    isExpanded ? 'px-4 gap-3' : 'justify-center px-0'
                  } ${
                    isActive
                      ? 'bg-accent text-on-accent font-semibold shadow-xs'
                      : 'text-white/70 hover:bg-navy-800/70 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive ? 'text-sky' : 'text-white/50 group-hover:text-sky'
                    }`}
                  />

                  {isExpanded && (
                    <>
                      <span className="truncate flex-1 text-left">{item.label}</span>

                      {badge !== null && (
                        <span
                          className={`shrink-0 min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                            isActive ? 'bg-surface text-accent' : 'bg-warn-fg text-navy-900'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </>
                  )}

                  {/* Indicador compacto de pendência quando recolhido */}
                  {!isExpanded && badge !== null && (
                    <span
                      className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-warn-fg"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}

            {filteredItems.length === 0 && isExpanded && (
              <p className="px-4 py-3 text-[11px] text-white/70">
                Nenhum item encontrado para “{searchTerm}”.
              </p>
            )}
          </div>
        </nav>

        {/* Rodapé: tema + novidades + usuário */}
        <div className={`pb-3 pt-2 border-t border-navy-800 ${isExpanded ? 'px-3' : 'px-2'}`}>
          {/* Alternância entre tema claro e escuro */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            className={`group w-full h-11 flex items-center gap-3 rounded-lg text-[13px] text-white/70 hover:bg-navy-800/70 hover:text-white transition-colors cursor-pointer ${
              isExpanded ? 'px-4' : 'justify-center px-0'
            }`}
          >
            {theme === 'dark' ? (
              <Sun className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            ) : (
              <Moon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
            )}
            {isExpanded && (
              <span className="truncate">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
            )}
          </button>

          {/* Novidades */}
          <div ref={newsRef} className="relative">
            {isNewsOpen && (
              <div
                role="dialog"
                aria-label="Novidades da versão"
                className={`absolute z-50 bottom-full mb-2 bg-surface text-text rounded-xl border border-line shadow-xl overflow-hidden ${
                  isExpanded ? 'left-0 right-0' : 'left-0 w-72'
                }`}
              >
                <div className="flex items-center gap-2 px-3.5 py-3 border-b border-line bg-subtle">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <p className="text-xs font-bold text-text">Novidades desta versão</p>
                </div>
                <ul className="px-3.5 py-3 space-y-2">
                  {NOVIDADES.map((item) => (
                    <li key={item} className="flex gap-2 text-[11px] text-muted leading-snug">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-accent shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setIsNewsOpen((open) => !open);
                setIsUserMenuOpen(false);
              }}
              aria-expanded={isNewsOpen}
              title={isExpanded ? undefined : 'Novidades'}
              className={`group w-full h-11 flex items-center gap-3 rounded-lg text-[13px] text-white/70 hover:bg-navy-800/70 hover:text-white transition-colors cursor-pointer ${
                isExpanded ? 'px-4' : 'justify-center px-0'
              }`}
            >
              <span className="relative shrink-0">
                <Megaphone className="w-[18px] h-[18px] group-hover:text-sky transition-colors" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-warn-fg" />
              </span>
              {isExpanded && <span className="truncate">Novidades</span>}
            </button>
          </div>

          {/* Usuário */}
          <div ref={userMenuRef} className="relative">
            {isUserMenuOpen && (
              <div
                className={`absolute z-50 bottom-full mb-2 bg-surface text-text rounded-xl border border-line shadow-xl overflow-hidden ${
                  isExpanded ? 'left-0 right-0' : 'left-0 w-64'
                }`}
                role="menu"
                aria-label="Opções do usuário"
              >
                <div className="px-3.5 py-3 bg-subtle border-b border-line">
                  <p className="text-xs font-bold text-text truncate">{userFullName}</p>
                  <p className="text-[11px] text-muted truncate mt-0.5">{userEmail}</p>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-medium text-muted hover:bg-subtle transition-colors cursor-not-allowed"
                  title="Disponível em uma próxima atualização"
                >
                  <UserRound className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">Alterar informações do perfil</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-subtle text-muted border border-line">
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
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-danger-fg hover:bg-danger-bg border-t border-line transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Sair</span>
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setIsUserMenuOpen((open) => !open);
                setIsNewsOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              title={isExpanded ? 'Abrir opções do usuário' : userFullName}
              className={`w-full flex items-center rounded-lg p-1.5 hover:bg-navy-800/70 transition-colors cursor-pointer ${
                isExpanded ? 'gap-2.5' : 'justify-center'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-navy-950 border border-accent/50 flex items-center justify-center text-[11px] font-bold text-sky shrink-0">
                {initials}
              </div>
              {isExpanded && (
                <>
                  <div className="flex flex-col min-w-0 text-left flex-1">
                    <span className="text-xs font-semibold text-white truncate">{userFullName}</span>
                    <span className="text-[10px] text-white/70 truncate">{userRole}</span>
                  </div>
                  <ChevronUp
                    className={`w-3.5 h-3.5 shrink-0 text-white/50 transition-transform ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
