import React, { useState } from 'react';
import { PhoneLine, Carrier, LineStatus, Device } from '../types';
import { dataService } from '../services/dataStorage';
import { formatDate, formatCurrency, formatPhone } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import {
  PhoneCall,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Smartphone,
  User,
  Link,
  Unlink,
  Eye,
  X,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface LinesViewProps {
  onOpenLineModal: (line?: PhoneLine) => void;
}

export const LinesView: React.FC<LinesViewProps> = ({ onOpenLineModal }) => {
  const [lines, setLines] = useState<PhoneLine[]>(dataService.getLines());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [carrierFilter, setCarrierFilter] = useState<string>('todos');
  const [associationFilter, setAssociationFilter] = useState<'todos' | 'com_aparelho' | 'sem_aparelho'>('todos');

  // Detail view
  const [detailLine, setDetailLine] = useState<PhoneLine | null>(null);

  // Association quick modal
  const [associatingLine, setAssociatingLine] = useState<PhoneLine | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const refreshData = () => {
    const list = dataService.getLines();
    setLines(list);
    if (detailLine) {
      setDetailLine(list.find(l => l.id === detailLine.id) || null);
    }
  };

  const filteredLines = lines.filter((l) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPhone = l.phoneNumber.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
      const matchCarrier = l.carrier.toLowerCase().includes(q);
      const matchPlan = l.planName.toLowerCase().includes(q);
      const matchCollab = l.currentCollaboratorName?.toLowerCase().includes(q) || false;
      const matchTag = l.associatedDeviceTag?.toLowerCase().includes(q) || false;
      if (!matchPhone && !matchCarrier && !matchPlan && !matchCollab && !matchTag) return false;
    }

    if (statusFilter !== 'todos' && l.status !== statusFilter) return false;
    if (carrierFilter !== 'todos' && l.carrier !== carrierFilter) return false;

    if (associationFilter === 'com_aparelho' && !l.associatedDeviceId) return false;
    if (associationFilter === 'sem_aparelho' && l.associatedDeviceId) return false;

    return true;
  });

  const handleDelete = (id: string, phone: string) => {
    if (window.confirm(`Deseja excluir a linha telefônica ${phone}?`)) {
      const res = dataService.deleteLine(id);
      if (!res.success) {
        alert(res.message);
      } else {
        refreshData();
      }
    }
  };

  const handleDisassociate = (id: string) => {
    if (window.confirm('Deseja desassociar esta linha telefônica do aparelho atual?')) {
      const res = dataService.disassociateLine(id);
      if (res.success) {
        refreshData();
      } else {
        alert(res.message);
      }
    }
  };

  const handleConfirmAssociate = () => {
    if (!associatingLine || !selectedDeviceId) return;
    const res = dataService.associateLineToDevice(associatingLine.id, selectedDeviceId);
    if (res.success) {
      setAssociatingLine(null);
      setSelectedDeviceId('');
      refreshData();
    } else {
      alert(res.message);
    }
  };

  const availableDevices = dataService.getDevices().filter(d => d.status !== 'Baixado');

  return (
    <div className="space-y-5">
      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-ink-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por número, operadora, plano, colaborador..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-ink-300 bg-white placeholder-ink-400 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>

          <button
            onClick={() => onOpenLineModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Linha</span>
          </button>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-100 text-xs">
          <span className="text-ink-500 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-ink-400" />
            Filtros:
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
          >
            <option value="todos">Status: Todos</option>
            <option value="Disponível">Disponível</option>
            <option value="Ativa">Ativa</option>
            <option value="Suspensa">Suspensa</option>
            <option value="Em processo de cancelamento">Em processo de cancelamento</option>
            <option value="Cancelada">Cancelada</option>
          </select>

          <select
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
          >
            <option value="todos">Operadora: Todas</option>
            <option value="Vivo">Vivo</option>
            <option value="Claro">Claro</option>
            <option value="TIM">TIM</option>
          </select>

          <select
            value={associationFilter}
            onChange={(e) => setAssociationFilter(e.target.value as any)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
          >
            <option value="todos">Vínculo: Todos</option>
            <option value="com_aparelho">Com Aparelho Associado</option>
            <option value="sem_aparelho">Sem Aparelho (Chip Livre / BYOD)</option>
          </select>

          <div className="ml-auto text-[11px] text-ink-500 tabular-nums">
            Exibindo <strong>{filteredLines.length}</strong> de <strong>{lines.length}</strong> linhas
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-ink-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-ink-50 border-b border-ink-200 text-ink-600 uppercase font-semibold tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Número da Linha</th>
                <th className="py-3 px-4">Operadora</th>
                <th className="py-3 px-4">Plano Contratado</th>
                <th className="py-3 px-4">Custo Mensal</th>
                <th className="py-3 px-4">Status da Linha</th>
                <th className="py-3 px-4">Aparelho Associado</th>
                <th className="py-3 px-4">Colaborador / Setor</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredLines.map((line) => (
                <tr 
                  key={line.id} 
                  className="hover:bg-ink-50/80 transition-colors group cursor-pointer"
                  onClick={() => setDetailLine(line)}
                >
                  {/* Phone */}
                  <td className="py-3 px-4 font-mono font-bold text-ink-900 whitespace-nowrap">
                    {formatPhone(line.phoneNumber)}
                  </td>

                  {/* Carrier */}
                  <td className="py-3 px-4 font-semibold text-ink-800">
                    {line.carrier}
                  </td>

                  {/* Plan */}
                  <td className="py-3 px-4 text-ink-700 max-w-[200px] truncate">
                    {line.planName}
                  </td>

                  {/* Cost */}
                  <td className="py-3 px-4 font-mono text-ink-700 tabular-nums">
                    {formatCurrency(line.monthlyCost)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <StatusBadge status={line.status} type="line" />
                  </td>

                  {/* Device */}
                  <td className="py-3 px-4">
                    {line.associatedDeviceTag ? (
                      <span className="font-mono font-medium text-iane-700 bg-iane-50 px-2 py-0.5 rounded border border-iane-200">
                        {line.associatedDeviceTag}
                      </span>
                    ) : (
                      <span className="text-ink-400 italic">Nenhum</span>
                    )}
                  </td>

                  {/* Collaborator */}
                  <td className="py-3 px-4">
                    {line.currentCollaboratorName ? (
                      <div>
                        <span className="font-medium text-ink-900">{line.currentCollaboratorName}</span>
                        {line.department && (
                          <span className="block text-[11px] text-ink-400">{line.department}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-ink-400 italic">Disponível em Estoque</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      title="Ver Detalhes"
                      onClick={() => setDetailLine(line)}
                      className="p-1.5 text-ink-500 hover:text-iane-600 hover:bg-iane-50 rounded-md transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {line.associatedDeviceId ? (
                      <button
                        title="Desassociar do aparelho"
                        onClick={() => handleDisassociate(line.id)}
                        className="p-1.5 text-gold-700 hover:text-gold-700 hover:bg-sun-50 rounded-md transition-colors"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        title="Associar a um aparelho celular"
                        onClick={() => setAssociatingLine(line)}
                        className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                      >
                        <Link className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      title="Editar"
                      onClick={() => onOpenLineModal(line)}
                      className="p-1.5 text-ink-500 hover:text-ink-800 hover:bg-ink-100 rounded-md transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      title="Excluir"
                      onClick={() => handleDelete(line.id, line.phoneNumber)}
                      className="p-1.5 text-ink-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredLines.length === 0 && (
            <div className="p-10 text-center text-ink-500">
              <PhoneCall className="w-10 h-10 text-ink-300 mx-auto mb-2" />
              <p className="font-semibold text-ink-700">Nenhuma linha encontrada</p>
              <p className="text-xs text-ink-500 mt-1">Ajuste os filtros de pesquisa para visualizar outros registros.</p>
            </div>
          )}
        </div>
      </div>

      {/* QUICK ASSOCIATION MODAL */}
      {associatingLine && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs" onClick={() => setAssociatingLine(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl border border-ink-200 w-full max-w-md p-6 space-y-4">
              <h3 className="text-sm font-bold text-ink-900">
                Associar Linha {associatingLine.phoneNumber} a um Aparelho
              </h3>
              <p className="text-xs text-ink-600">
                Selecione o aparelho celular corporativo no qual o chip SIM desta linha será instalado:
              </p>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Aparelho Alvo *
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                >
                  <option value="">-- Selecione o aparelho --</option>
                  {availableDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.assetTag} - {d.brand} {d.model} ({d.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setAssociatingLine(null)}
                  className="px-4 py-2 text-xs font-medium text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  disabled={!selectedDeviceId}
                  onClick={handleConfirmAssociate}
                  className="px-4 py-2 text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 rounded-lg disabled:opacity-50"
                >
                  Confirmar Associação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LINE DETAIL MODAL */}
      {detailLine && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs" onClick={() => setDetailLine(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl border border-ink-200 w-full max-w-2xl overflow-hidden p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-iane-600 text-white flex items-center justify-center">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink-900 font-mono">
                      {detailLine.phoneNumber}
                    </h2>
                    <p className="text-xs text-ink-500">
                      Operadora {detailLine.carrier} · {detailLine.planName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailLine(null)}
                  className="text-ink-400 hover:text-ink-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-ink-50 rounded-lg text-xs">
                <div>
                  <span className="text-ink-400 text-[11px] block">Status da Linha</span>
                  <StatusBadge status={detailLine.status} type="line" />
                </div>
                <div>
                  <span className="text-ink-400 text-[11px] block">Custo Mensal</span>
                  <span className="font-mono font-bold text-ink-900">{formatCurrency(detailLine.monthlyCost)}</span>
                </div>
                <div>
                  <span className="text-ink-400 text-[11px] block">Data de Ativação</span>
                  <span className="text-ink-900">{formatDate(detailLine.activationDate)}</span>
                </div>
                <div>
                  <span className="text-ink-400 text-[11px] block">ICCID (Chip)</span>
                  <span className="font-mono text-ink-900">{detailLine.iccid || 'Não registrado'}</span>
                </div>
                <div>
                  <span className="text-ink-400 text-[11px] block">Aparelho Associado</span>
                  <span className="font-semibold text-ink-900">{detailLine.associatedDeviceTag || 'Nenhum'}</span>
                </div>
                <div>
                  <span className="text-ink-400 text-[11px] block">Responsável Atual</span>
                  <span className="font-semibold text-ink-900">{detailLine.currentCollaboratorName || 'Sem responsável'}</span>
                </div>
              </div>

              {detailLine.notes && (
                <div className="text-xs p-3 bg-ink-100 rounded text-ink-700">
                  <span className="font-semibold block mb-0.5">Observações:</span>
                  {detailLine.notes}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setDetailLine(null)}
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
