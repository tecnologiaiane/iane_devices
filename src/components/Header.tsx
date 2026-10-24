import React from 'react';
import { Menu, Plus, ArrowLeftRight, Smartphone } from 'lucide-react';
import { NavTab } from './Sidebar';

import { User as UserType } from '../types';
import { LogOut, User } from 'lucide-react';

interface HeaderProps {
  activeTab: NavTab;
  onToggleMobile: () => void;
  onOpenMovementModal: () => void;
  onOpenDeviceModal: () => void;
  currentUser?: UserType | null;
  onLogout?: () => void;
}

const TAB_TITLES: Record<NavTab, { title: string; category: string }> = {
  dashboard: { title: 'Visão Geral Executiva', category: 'Painel de Controle' },
  dispositivos: { title: 'Gestão de Aparelhos Celulares', category: 'Ativos Patrimoniais' },
  linhas: { title: 'Linhas Telefônicas Corporativas', category: 'Telecomunicações' },
  colaboradores: { title: 'Responsáveis e Colaboradores', category: 'Recursos Humanos' },
  movimentacoes: { title: 'Histórico e Registro de Movimentações', category: 'Operações' },
  termos: { title: 'Termos e Documentos de Guarda', category: 'Compliance Jurídico' },
  relatorios: { title: 'Relatórios e Auditoria Patrimonial', category: 'Controladoria' },
  configuracoes: { title: 'Configurações e Importação da Planilha', category: 'Sistema' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onToggleMobile,
  onOpenMovementModal,
  onOpenDeviceModal,
  currentUser,
  onLogout,
}) => {
  const info = TAB_TITLES[activeTab] || { title: 'IANE - Gestão de Dispositivos', category: 'Gestão' };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobile}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="hidden sm:inline font-bold text-slate-700">IANE</span>
            <span className="hidden sm:inline text-slate-300">/</span>
            <span className="truncate">{info.category}</span>
          </div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate tracking-tight">
            {info.title}
          </h1>
        </div>
      </div>

      {/* Right: Quick Corporate Actions & User Status */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={onOpenDeviceModal}
          className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-slate-600" />
          <span>Cadastrar Aparelho</span>
        </button>

        <button
          onClick={onOpenMovementModal}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors whitespace-nowrap cursor-pointer"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Nova Movimentação</span>
        </button>

        {currentUser && onLogout && (
          <div className="flex items-center pl-2 ml-1 border-l border-slate-200 gap-2">
            <div className="hidden xl:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser.fullName}
              </span>
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                {currentUser.role}
              </span>
            </div>
            <button
              onClick={onLogout}
              title="Sair do sistema"
              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              aria-label="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
