import React from 'react';
import { DeviceStatus, LineStatus, CollaboratorStatus, TermStatus, DeviceCondition } from '../types';

interface StatusBadgeProps {
  status: DeviceStatus | LineStatus | CollaboratorStatus | TermStatus | DeviceCondition | string;
  type?: 'device' | 'line' | 'collaborator' | 'term' | 'condition' | 'request';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'device', size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  // Cores semânticas profissionais (alto contraste, sem excesso)
  let badgeStyles = 'bg-ink-100 text-ink-700 border-ink-200';
  let indicatorColor = 'bg-ink-400';

  switch (status) {
    // Aparelhos
    case 'Disponível':
      badgeStyles = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      indicatorColor = 'bg-emerald-500';
      break;
    case 'Em uso':
    case 'Ativa':
    case 'Ativo':
      badgeStyles = 'bg-iane-50 text-iane-800 border-iane-200';
      indicatorColor = 'bg-iane-600';
      break;
    case 'Aguardando avaliação':
      badgeStyles = 'bg-sun-50 text-gold-700 border-sun-300';
      indicatorColor = 'bg-sun-500';
      break;
    case 'Em manutenção':
      badgeStyles = 'bg-orange-50 text-orange-800 border-orange-200';
      indicatorColor = 'bg-orange-500';
      break;
    case 'Reservado':
      badgeStyles = 'bg-purple-50 text-purple-800 border-purple-200';
      indicatorColor = 'bg-purple-500';
      break;
    case 'Aguardando baixa patrimonial':
      badgeStyles = 'bg-rose-50 text-rose-800 border-rose-300';
      indicatorColor = 'bg-rose-500';
      break;
    case 'Extraviado':
    case 'Cancelada':
    case 'Desligado':
      badgeStyles = 'bg-rose-100 text-rose-900 border-rose-200';
      indicatorColor = 'bg-rose-600';
      break;
    case 'Baixado':
      badgeStyles = 'bg-ink-100 text-ink-600 border-ink-300';
      indicatorColor = 'bg-ink-400';
      break;
    case 'Suspensa':
    case 'Em processo de cancelamento':
      badgeStyles = 'bg-orange-50 text-orange-800 border-orange-200';
      indicatorColor = 'bg-orange-500';
      break;
    case 'Férias':
    case 'Afastado':
      badgeStyles = 'bg-indigo-50 text-indigo-800 border-indigo-200';
      indicatorColor = 'bg-indigo-500';
      break;
    case 'Assinado':
      badgeStyles = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      indicatorColor = 'bg-emerald-600';
      break;
    case 'Pendente de Assinatura':
      badgeStyles = 'bg-sun-50 text-gold-700 border-sun-300 font-medium';
      indicatorColor = 'bg-sun-500';
      break;
    case 'Pendente de aprovação':
      badgeStyles = 'bg-sun-50 text-gold-700 border-sun-300 font-medium';
      indicatorColor = 'bg-sun-500';
      break;
    case 'Aprovada':
      badgeStyles = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      indicatorColor = 'bg-emerald-600';
      break;
    case 'Recusada':
      badgeStyles = 'bg-rose-50 text-rose-800 border-rose-200';
      indicatorColor = 'bg-rose-600';
      break;
    case 'Arquivado':
      badgeStyles = 'bg-ink-100 text-ink-700 border-ink-300';
      indicatorColor = 'bg-ink-400';
      break;

    // Condição
    case 'Novo':
      badgeStyles = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      indicatorColor = 'bg-emerald-500';
      break;
    case 'Excelente':
      badgeStyles = 'bg-cyan-50 text-cyan-800 border-cyan-200';
      indicatorColor = 'bg-cyan-500';
      break;
    case 'Bom':
      badgeStyles = 'bg-sky-50 text-sky-800 border-sky-200';
      indicatorColor = 'bg-sky-500';
      break;
    case 'Regular':
      badgeStyles = 'bg-sun-50 text-gold-700 border-sun-300';
      indicatorColor = 'bg-sun-500';
      break;
    case 'Danificado':
      badgeStyles = 'bg-rose-50 text-rose-800 border-rose-200';
      indicatorColor = 'bg-rose-500';
      break;
    default:
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-md font-medium tracking-tight whitespace-nowrap ${badgeStyles} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor} shrink-0`} aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
};
