import React from 'react';
import { dataService } from '../services/dataStorage';
import { formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import {
  Smartphone,
  PhoneCall,
  Users,
  AlertTriangle,
  ArrowLeftRight,
  FileCheck2,
  Clock,
  Wrench,
  CheckCircle2,
  TrendingUp,
  Building2,
  ShieldAlert,
  ArrowRight,
  Package,
  Layers,
  HelpCircle
} from 'lucide-react';
import { NavTab } from '../components/Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenMovementModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenMovementModal,
}) => {
  const metrics = dataService.getDashboardMetrics();
  const devices = dataService.getDevices();
  const lines = dataService.getLines();
  const movements = dataService.getMovements();
  const terms = dataService.getTerms();

  // Dynamic calculations for charts
  const devicesByBrand: Record<string, number> = {};
  devices.forEach(d => {
    devicesByBrand[d.brand] = (devicesByBrand[d.brand] || 0) + 1;
  });

  const devicesByDepartment: Record<string, number> = {};
  devices.forEach(d => {
    const dept = d.currentDepartment || 'Estoque do Gestor de Telefonia';
    devicesByDepartment[dept] = (devicesByDepartment[dept] || 0) + 1;
  });

  const linesByCarrier: Record<string, number> = {};
  lines.forEach(l => {
    linesByCarrier[l.carrier] = (linesByCarrier[l.carrier] || 0) + 1;
  });

  // Attention lists
  const maintenanceDevices = devices.filter(d => d.status === 'Em manutenção');
  const evaluatingDevices = devices.filter(d => d.status === 'Aguardando avaliação');
  const pendingTerms = terms.filter(t => t.status === 'Pendente de Assinatura');
  const orphanActiveLines = lines.filter(l => l.status === 'Ativa' && !l.currentCollaboratorId);

  return (
    <div className="space-y-6">
      {/* Top Banner Alert Bar if any issues */}
      {(pendingTerms.length > 0 || maintenanceDevices.length > 0 || evaluatingDevices.length > 0) && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <span className="font-semibold text-slate-900">Pendências e Gestão de Estoque: </span>
              <span>
                {evaluatingDevices.length} aparelho(s) aguardando avaliação no estoque · {maintenanceDevices.length} em manutenção · {pendingTerms.length} termo(s) pendente(s) de assinatura.
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('dispositivos')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>Gerenciar Estoque</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary KPI Grid (Tabular Numerals) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Aparelhos */}
        <div 
          onClick={() => onNavigate('dispositivos')}
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Frota Total</span>
            <Smartphone className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.totalDevices}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            Aparelhos cadastrados
          </div>
        </div>

        {/* Em Uso (Com Colaborador) */}
        <div 
          onClick={() => onNavigate('dispositivos')}
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Em Uso (Ativos)</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.inUseDevices}
          </div>
          <div className="mt-1.5 text-[11px] text-blue-700 font-medium">
            Com colaboradores
          </div>
        </div>

        {/* Total Estoque do Gestor */}
        <div 
          onClick={() => onNavigate('dispositivos')}
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Estoque do Gestor</span>
            <Package className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.stockTotal}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            Total sob custódia de TI
          </div>
        </div>

        {/* Disponíveis no Estoque (Prontos para Entrega) */}
        <div 
          onClick={() => onNavigate('dispositivos')}
          className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 hover:border-emerald-300 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-xs font-bold">Estoque Disponível</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-900">
            {metrics.stockAvailable}
          </div>
          <div className="mt-1.5 text-[11px] text-emerald-700 font-medium">
            Prontos para entrega
          </div>
        </div>

        {/* Estoque Indisponível (Avaliação / Manutenção / Reserva) */}
        <div 
          onClick={() => onNavigate('dispositivos')}
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Estoque Retido</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-800">
            {metrics.stockAwaitingEvaluation + metrics.stockMaintenance + metrics.stockReserved + metrics.stockAwaitingDisposal}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            Avaliação, reparo ou reserva
          </div>
        </div>

        {/* Total Linhas */}
        <div 
          onClick={() => onNavigate('linhas')}
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Linhas Telefônicas</span>
            <PhoneCall className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.totalLines}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            <span className="text-blue-700 font-semibold tabular-nums">{metrics.activeLines}</span> ativas · <span className="text-emerald-700 font-semibold tabular-nums">{metrics.availableLines}</span> livres
          </div>
        </div>
      </div>

      {/* Panorama Detalhado do Estoque do Gestor de Telefonia */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Controle Operacional do Estoque do Gestor de Telefonia ({metrics.stockTotal} ativos sem colaborador)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 italic">
            Somente aparelhos "Disponíveis" podem ser entregues a colaboradores
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
            <span className="text-emerald-800 font-semibold block">Disponível</span>
            <span className="text-xl font-bold font-mono text-emerald-900 tabular-nums mt-0.5 block">{metrics.stockAvailable}</span>
            <span className="text-[10px] text-emerald-700">Liberados para nova entrega</span>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
            <span className="text-amber-800 font-semibold block">Aguardando Avaliação</span>
            <span className="text-xl font-bold font-mono text-amber-900 tabular-nums mt-0.5 block">{metrics.stockAwaitingEvaluation}</span>
            <span className="text-[10px] text-amber-700">Vistoria e higienização</span>
          </div>

          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs">
            <span className="text-orange-800 font-semibold block">Em Manutenção</span>
            <span className="text-xl font-bold font-mono text-orange-900 tabular-nums mt-0.5 block">{metrics.stockMaintenance}</span>
            <span className="text-[10px] text-orange-700">Em assistência técnica</span>
          </div>

          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs">
            <span className="text-purple-800 font-semibold block">Reservado</span>
            <span className="text-xl font-bold font-mono text-purple-900 tabular-nums mt-0.5 block">{metrics.stockReserved}</span>
            <span className="text-[10px] text-purple-700">Admissão programada</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="text-slate-700 font-semibold block">Aguardando Baixa</span>
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-0.5 block">{metrics.stockAwaitingDisposal}</span>
            <span className="text-[10px] text-slate-500">Inutilizado / Perda total</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid: SVG Charts & Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Status Geral dos Aparelhos */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Distribuição por Status</h2>
              <p className="text-xs text-slate-500">Situação operacional de toda a base</p>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
              {metrics.totalDevices} total
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {[
              { label: 'Em uso (com colaborador)', count: metrics.inUseDevices, color: 'bg-blue-600' },
              { label: 'Disponível em estoque', count: metrics.stockAvailable, color: 'bg-emerald-500' },
              { label: 'Aguardando avaliação', count: metrics.stockAwaitingEvaluation, color: 'bg-amber-500' },
              { label: 'Em manutenção', count: metrics.stockMaintenance, color: 'bg-orange-500' },
              { label: 'Reservado', count: metrics.stockReserved, color: 'bg-purple-500' },
              { label: 'Aguardando baixa / Baixado', count: metrics.stockAwaitingDisposal + metrics.stockDisposed, color: 'bg-slate-400' },
            ].map((st) => {
              const pct = metrics.totalDevices > 0 ? Math.round((st.count / metrics.totalDevices) * 100) : 0;
              return (
                <div key={st.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">{st.label}</span>
                    <span className="font-mono text-slate-600 tabular-nums">
                      {st.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${st.color} rounded-full transition-all duration-300`} 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Alocação por Departamento */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Alocação por Departamento</h2>
              <p className="text-xs text-slate-500">Distribuição setorial e estoque</p>
            </div>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3 pt-1">
            {Object.entries(devicesByDepartment).map(([dept, count]) => {
              const pct = metrics.totalDevices > 0 ? Math.round((count / metrics.totalDevices) * 100) : 0;
              return (
                <div key={dept} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate max-w-[180px]">{dept}</span>
                    <span className="font-mono text-slate-600 tabular-nums">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-700 rounded-full transition-all duration-300" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 3: Operadoras e Ação Rápida */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Linhas por Operadora</h2>
                <p className="text-xs text-slate-500">Ecossistema de telecomunicações</p>
              </div>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {Object.entries(linesByCarrier).map(([carrier, count]) => (
                <div key={carrier} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <div className="text-[11px] font-bold text-slate-700">{carrier}</div>
                  <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {count}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                Aparelhos por Fabricante:
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(devicesByBrand).map(([brand, count]) => (
                  <span key={brand} className="text-xs px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md font-medium text-slate-800">
                    {brand}: <span className="font-bold font-mono">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={onOpenMovementModal}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Iniciar Movimentação Oficial</span>
            </button>
          </div>
        </div>
      </div>

      {/* Operational Alerts & Recent Activity Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Alertas e Prazos */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Aparelhos Retidos no Estoque & Pendências</h2>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Controle de Estoque</span>
          </div>

          <div className="space-y-3 text-xs">
            {evaluatingDevices.map((d) => (
              <div key={d.id} className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-950 font-mono">{d.assetTag} - {d.brand} {d.model}</span>
                    <StatusBadge status="Aguardando avaliação" type="device" size="sm" />
                  </div>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {d.notes || 'Equipamento devolvido ao estoque do gestor, pendente de vistoria para liberação.'}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('dispositivos')}
                  className="text-xs font-semibold text-amber-900 hover:underline shrink-0"
                >
                  Liberar Estoque
                </button>
              </div>
            ))}

            {maintenanceDevices.map((d) => (
              <div key={d.id} className="p-3 bg-orange-50/70 border border-orange-200 rounded-lg flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-orange-950 font-mono">{d.assetTag} - {d.brand} {d.model}</span>
                    <StatusBadge status="Em manutenção" type="device" size="sm" />
                  </div>
                  <p className="text-[11px] text-orange-800 mt-0.5">
                    {d.notes}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('dispositivos')}
                  className="text-xs font-semibold text-orange-900 hover:underline shrink-0"
                >
                  Retorno Manutenção
                </button>
              </div>
            ))}

            {pendingTerms.map((t) => (
              <div key={t.id} className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start justify-between gap-3">
                <div>
                  <span className="font-bold text-blue-950 font-mono">{t.code}</span>
                  <span className="text-slate-600"> · {t.collaboratorName}</span>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    Termo oficial gerado, aguardando assinatura formal.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('termos')}
                  className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                >
                  Assinar Termo
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Últimas Movimentações */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-bold text-slate-900">Histórico de Passagem por Estoque</h2>
            </div>
            <button
              onClick={() => onNavigate('movimentacoes')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Ver Todas ({movements.length})
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {movements.slice(0, 6).map((m) => (
              <div key={m.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{m.type}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-blue-700 font-bold">{m.deviceTag || 'Ativo'}</span>
                    {m.batchOperationId && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                        {m.batchOperationId}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 truncate text-[11px]">
                    <span className="text-slate-400">Origem:</span> {m.originCollaboratorName || 'Estoque'} → <span className="text-slate-400">Destino:</span> {m.destinationCollaboratorName || 'Estoque'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-mono text-slate-500">{formatDate(m.date)}</span>
                  {m.stockTransit?.stage && (
                    <span className="block text-[10px] text-indigo-700 font-medium">
                      {m.stockTransit.stage}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
