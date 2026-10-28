import React from 'react';
import { ArrowLeftRight, Smartphone } from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  activeTab: NavTab;
  onOpenMovementModal: () => void;
  onOpenDeviceModal: () => void;
}

const TAB_TITLES: Record<NavTab, { title: string; category: string }> = {
  dashboard: { title: 'Visão Geral Executiva', category: 'Painel de Controle' },
  dispositivos: { title: 'Gestão de Aparelhos Celulares', category: 'Ativos Patrimoniais' },
  linhas: { title: 'Linhas Telefônicas Corporativas', category: 'Telecomunicações' },
  colaboradores: { title: 'Responsáveis e Colaboradores', category: 'Recursos Humanos' },
  movimentacoes: { title: 'Histórico e Registro de Movimentações', category: 'Operações' },
  termos: { title: 'Termos e Documentos de Guarda', category: 'Compliance Jurídico' },
  relatorios: { title: 'Relatórios e Auditoria Patrimonial', category: 'Controladoria' },
  configuracoes: { title: 'Configurações do Sistema', category: 'Sistema' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMovementModal,
  onOpenDeviceModal,
}) => {
  const info = TAB_TITLES[activeTab] || { title: 'IANE - Gestão de Dispositivos', category: 'Gestão' };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-ink-200 h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-ink-500 font-medium">
            <span className="hidden sm:inline font-bold text-ink-700">IANE</span>
            <span className="hidden sm:inline text-ink-300">/</span>
            <span className="truncate">{info.category}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-900 truncate tracking-tight">
            {info.title}
          </h1>
        </div>
      </div>

      {/* Right: Quick Corporate Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={onOpenDeviceModal}
          className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-ink-600" />
          <span>Cadastrar Aparelho</span>
        </button>

        <button
          onClick={onOpenMovementModal}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 shadow-xs transition-colors whitespace-nowrap cursor-pointer"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Nova Movimentação</span>
        </button>
      </div>
    </header>
  );
};
