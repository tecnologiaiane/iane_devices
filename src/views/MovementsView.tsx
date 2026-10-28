import React, { useState } from 'react';
import { Movement, MovementType, DocumentTerm } from '../types';
import { dataService, STOCK_LABEL } from '../services/dataStorage';
import { formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import {
  ArrowLeftRight,
  Search,
  Filter,
  Plus,
  FileText,
  Eye,
  CheckCircle2,
  Calendar,
  X,
  ShieldCheck,
  User,
  Package,
  Layers,
  ArrowRight
} from 'lucide-react';
import { OfficialFlowType } from '../components/modals/MovementModal';

interface MovementsViewProps {
  onOpenMovementModal: (flow?: OfficialFlowType) => void;
  onViewTerm: (term: DocumentTerm) => void;
}

export const MovementsView: React.FC<MovementsViewProps> = ({
  onOpenMovementModal,
  onViewTerm,
}) => {
  const [movements, setMovements] = useState<Movement[]>(dataService.getMovements());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected movement for detail
  const [detailMovement, setDetailMovement] = useState<Movement | null>(null);

  const filteredMovements = movements.filter((m) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = m.code.toLowerCase().includes(q);
      const matchBatch = m.batchOperationId?.toLowerCase().includes(q) || false;
      const matchDevice = m.deviceTag?.toLowerCase().includes(q) || false;
      const matchName = m.deviceName?.toLowerCase().includes(q) || false;
      const matchLine = m.phoneNumber?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || false;
      const matchDest = m.destinationCollaboratorName?.toLowerCase().includes(q) || false;
      const matchOrig = m.originCollaboratorName?.toLowerCase().includes(q) || false;
      const matchReason = m.reason?.toLowerCase().includes(q) || false;
      if (!matchCode && !matchBatch && !matchDevice && !matchName && !matchLine && !matchDest && !matchOrig && !matchReason) {
        return false;
      }
    }

    if (typeFilter !== 'todos' && !m.type.toLowerCase().includes(typeFilter.toLowerCase())) return false;
    if (startDate && m.date < startDate) return false;
    if (endDate && m.date > endDate) return false;

    return true;
  });

  const handleOpenLinkedTerm = (termId?: string) => {
    if (!termId) return;
    const term = dataService.getTermById(termId);
    if (term) {
      onViewTerm(term);
    } else {
      alert('Documento não localizado no arquivo digital.');
    }
  };

  return (
    <div className="space-y-5">
      {/* 4 Official Movement Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onOpenMovementModal('entrega')}
          className="p-3 bg-white hover:bg-ink-50 border border-ink-200 hover:border-iane-400 rounded-xl transition-all shadow-xs text-left group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-ink-900 group-hover:text-iane-600">1. Entrega</span>
            <ArrowRight className="w-3.5 h-3.5 text-ink-400 group-hover:text-iane-600" />
          </div>
          <p className="text-[11px] text-ink-500">Estoque → Colaborador</p>
        </button>

        <button
          onClick={() => onOpenMovementModal('devolucao')}
          className="p-3 bg-white hover:bg-ink-50 border border-ink-200 hover:border-sun-400 rounded-xl transition-all shadow-xs text-left group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-ink-900 group-hover:text-gold-700">2. Devolução</span>
            <ArrowRight className="w-3.5 h-3.5 text-ink-400 group-hover:text-gold-700" />
          </div>
          <p className="text-[11px] text-ink-500">Colaborador → Estoque</p>
        </button>

        <button
          onClick={() => onOpenMovementModal('transferencia')}
          className="p-3 bg-white hover:bg-ink-50 border border-ink-200 hover:border-indigo-400 rounded-xl transition-all shadow-xs text-left group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-ink-900 group-hover:text-indigo-600">3. Transferência</span>
            <ArrowRight className="w-3.5 h-3.5 text-ink-400 group-hover:text-indigo-600" />
          </div>
          <p className="text-[11px] text-ink-500">A → Estoque → B</p>
        </button>

        <button
          onClick={() => onOpenMovementModal('troca')}
          className="p-3 bg-white hover:bg-ink-50 border border-ink-200 hover:border-emerald-400 rounded-xl transition-all shadow-xs text-left group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-ink-900 group-hover:text-emerald-600">4. Troca de Aparelho</span>
            <ArrowRight className="w-3.5 h-3.5 text-ink-400 group-hover:text-emerald-600" />
          </div>
          <p className="text-[11px] text-ink-500">Antigo → Estoque | Novo ← Estoque</p>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-ink-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código (MOV-... ou TRF-...), aparelho, linha ou colaborador..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-ink-300 bg-white placeholder-ink-400 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>

          <button
            onClick={() => onOpenMovementModal('entrega')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Operação</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-100 text-xs">
          <span className="text-ink-500 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-ink-400" />
            Filtros:
          </span>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
          >
            <option value="todos">Tipo: Todos</option>
            <option value="Entrega">Entrega (Estoque → Colaborador)</option>
            <option value="Devolução">Devolução (Colaborador → Estoque)</option>
            <option value="Transferência">Transferências (A → Estoque → B)</option>
            <option value="Troca">Trocas de Aparelho</option>
            <option value="Liberação de Estoque">Liberação de Estoque</option>
            <option value="Manutenção">Manutenção</option>
          </select>

          <div className="flex items-center gap-1 text-ink-600">
            <span className="text-[11px]">De:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-ink-300 bg-white px-2 py-0.5 text-xs text-ink-700 font-mono"
            />
          </div>

          <div className="flex items-center gap-1 text-ink-600">
            <span className="text-[11px]">Até:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-ink-300 bg-white px-2 py-0.5 text-xs text-ink-700 font-mono"
            />
          </div>

          {(typeFilter !== 'todos' || startDate || endDate) && (
            <button
              onClick={() => {
                setTypeFilter('todos');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-iane-600 hover:text-iane-800 font-medium ml-2"
            >
              Limpar Filtros
            </button>
          )}

          <div className="ml-auto text-[11px] text-ink-500 tabular-nums">
            Exibindo <strong>{filteredMovements.length}</strong> de <strong>{movements.length}</strong> movimentações
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-ink-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-ink-50 border-b border-ink-200 text-ink-600 uppercase font-semibold tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Código / Data</th>
                <th className="py-3 px-4">Operação Oficial</th>
                <th className="py-3 px-4">Fluxo Patrimonial</th>
                <th className="py-3 px-4">Aparelho Envolvido</th>
                <th className="py-3 px-4">Motivo / Condição</th>
                <th className="py-3 px-4">Termo Oficial</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredMovements.map((mov) => (
                <tr 
                  key={mov.id} 
                  className="hover:bg-ink-50/80 transition-colors group cursor-pointer"
                  onClick={() => setDetailMovement(mov)}
                >
                  {/* Code & Date */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-ink-900 block">{mov.code}</span>
                    <span className="text-[11px] font-mono text-ink-500">{formatDate(mov.date)}</span>
                    {mov.batchOperationId && (
                      <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 mt-0.5 inline-block">
                        {mov.batchOperationId}
                      </span>
                    )}
                  </td>

                  {/* Type */}
                  <td className="py-3 px-4">
                    <span className="font-semibold text-ink-900 block">{mov.type}</span>
                    {mov.stockTransit?.stage && (
                      <span className="text-[10px] text-iane-700 font-medium">
                        {mov.stockTransit.stage}
                      </span>
                    )}
                  </td>

                  {/* Flow with stock highlight */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className={`px-1.5 py-0.5 rounded ${mov.originCollaboratorName === STOCK_LABEL ? 'bg-indigo-50 text-indigo-800 font-bold' : 'text-ink-800 font-medium'}`}>
                        {mov.originCollaboratorName || STOCK_LABEL}
                      </span>
                      <ArrowRight className="w-3 h-3 text-ink-400 shrink-0" />
                      <span className={`px-1.5 py-0.5 rounded ${mov.destinationCollaboratorName === STOCK_LABEL ? 'bg-indigo-50 text-indigo-800 font-bold' : 'text-ink-800 font-medium'}`}>
                        {mov.destinationCollaboratorName || STOCK_LABEL}
                      </span>
                    </div>
                  </td>

                  {/* Device */}
                  <td className="py-3 px-4">
                    {mov.deviceTag ? (
                      <div>
                        <span className="font-mono font-bold text-iane-700">{mov.deviceTag}</span>
                        <span className="block text-[11px] text-ink-500 truncate max-w-[150px]">{mov.deviceName}</span>
                      </div>
                    ) : (
                      <span className="text-ink-400 italic">Nenhum</span>
                    )}
                  </td>

                  {/* Reason & Condition */}
                  <td className="py-3 px-4 max-w-[200px]">
                    <p className="text-ink-700 truncate">{mov.reason || 'Movimentação patrimonial regular'}</p>
                    {mov.conditionAtMovement && (
                      <span className="inline-block mt-0.5">
                        <StatusBadge status={mov.conditionAtMovement} type="condition" size="sm" />
                      </span>
                    )}
                  </td>

                  {/* Term */}
                  <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {mov.documentId ? (
                      <button
                        onClick={() => handleOpenLinkedTerm(mov.documentId)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-iane-50 hover:bg-iane-100 text-iane-700 rounded-md font-mono text-xs font-semibold border border-iane-200 transition-colors"
                      >
                        <FileText className="w-3 h-3 text-iane-600" />
                        <span>{mov.documentCode || 'Ver Termo'}</span>
                      </button>
                    ) : (
                      <span className="text-ink-400 italic text-[11px]">Sem termo anexado</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setDetailMovement(mov)}
                      className="p-1.5 text-ink-500 hover:text-iane-600 hover:bg-iane-50 rounded-md"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredMovements.length === 0 && (
            <div className="p-10 text-center text-ink-500">
              <ArrowLeftRight className="w-10 h-10 text-ink-300 mx-auto mb-2" />
              <p className="font-semibold text-ink-700">Nenhuma movimentação encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* DETAIL MODAL */}
      {detailMovement && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs" onClick={() => setDetailMovement(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div 
              className="relative bg-white rounded-xl shadow-2xl border border-ink-200 w-full max-w-2xl overflow-hidden p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-ink-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-iane-600 text-white flex items-center justify-center font-bold">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-ink-900 font-mono">
                        {detailMovement.code}
                      </h2>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-ink-100 text-ink-800 border border-ink-200">
                        {detailMovement.type}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500">
                      Registrado em {formatDate(detailMovement.date)} por {detailMovement.registeredBy}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailMovement(null)}
                  className="text-ink-400 hover:text-ink-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Rota Oficial com Estoque */}
              <div className="p-3 bg-iane-50/70 border border-iane-200 rounded-lg text-xs space-y-1">
                <span className="font-semibold text-iane-800 block">Fluxo de Custódia Patrimonial:</span>
                <div className="flex items-center gap-2 font-bold text-iane-800">
                  <span>{detailMovement.originCollaboratorName || STOCK_LABEL}</span>
                  <ArrowRight className="w-4 h-4 text-iane-500" />
                  <span>{detailMovement.destinationCollaboratorName || STOCK_LABEL}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-ink-50 rounded-lg text-xs">
                <div>
                  <span className="text-ink-400 text-[11px] block">Aparelho Envolvido</span>
                  <span className="font-semibold text-ink-900 font-mono">
                    {detailMovement.deviceTag || 'N/A'} {detailMovement.deviceName ? `(${detailMovement.deviceName})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-ink-400 text-[11px] block">Linha Telefônica</span>
                  <span className="font-mono text-ink-900">{detailMovement.phoneNumber || 'Nenhuma'}</span>
                </div>
                {detailMovement.batchOperationId && (
                  <div>
                    <span className="text-ink-400 text-[11px] block">Operação Conjunta</span>
                    <span className="font-mono text-indigo-700 font-bold">{detailMovement.batchOperationId}</span>
                  </div>
                )}
                {detailMovement.conditionAtMovement && (
                  <div>
                    <span className="text-ink-400 text-[11px] block">Estado de Conservação</span>
                    <StatusBadge status={detailMovement.conditionAtMovement} type="condition" size="sm" />
                  </div>
                )}
              </div>

              {detailMovement.accessoriesIncluded && detailMovement.accessoriesIncluded.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-ink-700 block mb-1">
                    Itens e Acessórios Concomitantes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {detailMovement.accessoriesIncluded.map((acc, idx) => (
                      <span key={idx} className="text-xs px-2.5 py-1 bg-ink-100 border border-ink-200 rounded text-ink-700">
                        ✓ {acc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detailMovement.reason && (
                <div className="text-xs bg-ink-50 p-3 rounded border border-ink-200 text-ink-800">
                  <span className="font-semibold block mb-0.5">Motivo / Justificativa:</span>
                  {detailMovement.reason}
                </div>
              )}

              {detailMovement.documentId && (
                <div className="p-3 bg-iane-50 border border-iane-200 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-iane-600" />
                    <div>
                      <span className="font-bold text-iane-800">{detailMovement.documentCode}</span>
                      <span className="text-iane-700 block text-[11px]">Termo oficial gerado nesta operação</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const id = detailMovement.documentId;
                      setDetailMovement(null);
                      handleOpenLinkedTerm(id);
                    }}
                    className="px-3 py-1 bg-iane-600 hover:bg-iane-700 text-white rounded font-semibold text-xs shadow-xs"
                  >
                    Abrir Termo Oficial
                  </button>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setDetailMovement(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-lg"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
