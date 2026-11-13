import React, { useEffect, useState } from 'react';
import { PhoneLine, Carrier, LineStatus, Device, Catalogs } from '../types';
import { dataService } from '../services/dataStorage';
import { formatDate, formatCurrency, formatPhone, matchesPhoneSearch } from '../utils/formatters';
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
  Clock,
} from 'lucide-react';
import { Button } from '../components/button';
import { Badge } from '../components/badge';

interface LinesViewProps {
  onOpenLineModal: (line?: PhoneLine) => void;
}

export const LinesView: React.FC<LinesViewProps> = ({ onOpenLineModal }) => {
  const [lines, setLines] = useState<PhoneLine[]>(dataService.getLines());
  const [catalogs, setCatalogs] = useState<Catalogs>(() => dataService.getCatalogs());
  useEffect(() => { void dataService.fetchCatalogs().then(setCatalogs); }, []);
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
      const matchPhone = matchesPhoneSearch(l.phoneNumber, searchQuery);
      const matchCarrier = l.carrier.toLowerCase().includes(q);
      const matchPlan = (l.planName || '').toLowerCase().includes(q);
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
      <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por número, operadora, plano, colaborador..."
              className="w-full pl-9 pr-3 py-2 text-xs radius-base border border-border-subtle bg-surface-card placeholder-text-muted text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
            />
          </div>

          <button
            onClick={() => onOpenLineModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 radius-lg text-xs font-medium text-white bg-brand-blue-action hover:bg-brand-blue-action-hover shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Linha</span>
          </button>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle text-xs">
          <span className="text-text-muted font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-text-muted" />
            Filtros:
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-auto radius-base border border-border-subtle bg-surface-card px-2.5 py-1 text-text-muted font-medium focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
          >
            <option value="todos">Status: Todos</option>
            {catalogs.lineStatuses.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>

          <select
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            className="w-auto radius-base border border-border-subtle bg-surface-card px-2.5 py-1 text-text-muted font-medium focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
          >
            <option value="todos">Operadora: Todas</option>
            <option value="Vivo">Vivo</option>
            <option value="Claro">Claro</option>
            <option value="TIM">TIM</option>
          </select>

          <select
            value={associationFilter}
            onChange={(e) => setAssociationFilter(e.target.value as any)}
            className="w-auto radius-base border border-border-subtle bg-surface-card px-2.5 py-1 text-text-muted font-medium focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
          >
            <option value="todos">Vínculo: Todos</option>
            <option value="com_aparelho">Com Aparelho Associado</option>
            <option value="sem_aparelho">Sem Aparelho (Chip Livre / BYOD)</option>
          </select>

          <div className="ml-auto flex items-center gap-1 text-text-muted">
            <span className="text-[11px]">Exibindo</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{filteredLines.length}</span>
            <span className="text-[11px]">de</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{lines.length}</span>
            <span className="text-[11px]">linhas</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
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
            <tbody className="divide-y divide-border-subtle">
              {filteredLines.map((line) => (
                <tr 
                  key={line.id} 
                  className="hover:bg-surface-subtle transition-colors group cursor-pointer"
                  onClick={() => setDetailLine(line)}
                >
                  {/* Phone */}
                  <td className="py-3 px-4 font-code font-bold text-text-primary whitespace-nowrap">
                    {formatPhone(line.phoneNumber)}
                  </td>

                  {/* Carrier */}
                  <td className="py-3 px-4 font-semibold text-text-primary">
                    {line.carrier}
                  </td>

                  {/* Plan */}
                  <td className="py-3 px-4 text-text-muted max-w-[200px] truncate">
                    {line.planName || 'Não informado'}
                  </td>

                  {/* Cost */}
                  <td className="py-3 px-4 font-code text-text-muted tabular-nums">
                    {formatCurrency(line.monthlyCost)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <StatusBadge status={line.status} type="line" />
                  </td>

                  {/* Device */}
                  <td className="py-3 px-4">
                    {line.associatedDeviceTag ? (
                      <Badge variant="info" size="sm" showDot className="text-[11px]">
                        <PhoneCall className="w-2.5 h-2.5" />
                        {line.associatedDeviceTag}
                      </Badge>
                    ) : (
                      <span className="text-text-muted italic font-body">Nenhum</span>
                    )}
                  </td>

                  {/* Collaborator */}
                  <td className="py-3 px-4">
                    {line.currentCollaboratorName ? (
                      <div>
                        <span className="font-medium text-text-primary">{line.currentCollaboratorName}</span>
                        {line.department && (
                          <span className="block text-[11px] text-text-muted">{line.department}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-muted italic font-body">Disponível em Estoque</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      title="Ver Detalhes"
                      onClick={() => setDetailLine(line)}
                      className="p-1.5 text-text-muted hover:text-brand-blue-action hover:bg-surface-subtle radius-base transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {line.associatedDeviceId ? (
                      <button
                        title="Desassociar do aparelho"
                        onClick={() => handleDisassociate(line.id)}
                        className="p-1.5 text-status-warning-fg hover:bg-status-warning-bg radius-base transition-colors"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        title="Associar a um aparelho celular"
                        onClick={() => setAssociatingLine(line)}
                        className="p-1.5 text-status-success-fg hover:bg-status-success-bg radius-base transition-colors"
                      >
                        <Link className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      title="Editar"
                      onClick={() => onOpenLineModal(line)}
                      className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-subtle radius-base transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      title="Excluir"
                      onClick={() => handleDelete(line.id, line.phoneNumber)}
                      className="p-1.5 text-text-muted hover:text-status-danger-fg hover:bg-status-danger-bg radius-base transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredLines.length === 0 && (
            <div className="p-10 text-center text-text-muted">
              <PhoneCall className="w-10 h-10 text-border-strong mx-auto mb-2" />
              <p className="font-semibold text-text-primary">Nenhuma linha encontrada</p>
              <p className="text-[11px] text-text-muted mt-1">Ajuste os filtros de pesquisa para visualizar outros registros.</p>
            </div>
          )}
        </div>
      </div>

      {/* QUICK ASSOCIATION MODAL */}
      {associatingLine && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-brand-navy-dark/45 backdrop-blur-sm" onClick={() => setAssociatingLine(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-surface-card radius-lg border border-border-subtle shadow-lg w-full max-w-md p-5 space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Associar Linha {associatingLine.phoneNumber} a um Aparelho
              </h3>
              <p className="text-[11px] text-text-muted">
                Selecione o aparelho celular corporativo no qual o chip SIM desta linha será instalado:
              </p>

              <div>
                <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                  Aparelho Alvo *
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
                >
                  <option value="">-- Selecione o aparelho --</option>
                  {availableDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.assetTag} - {d.model} ({d.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <Button variant="ghost" size="sm" onClick={() => setAssociatingLine(null)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" disabled={!selectedDeviceId} onClick={handleConfirmAssociate}>
                  Confirmar Associação
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LINE DETAIL MODAL */}
      {detailLine && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-brand-navy-dark/45 backdrop-blur-sm" onClick={() => setDetailLine(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-surface-card radius-lg border border-border-subtle shadow-lg w-full max-w-2xl overflow-hidden p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 radius-base bg-brand-blue-action text-white flex items-center justify-center">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary font-code">
                      {detailLine.phoneNumber}
                    </h2>
                    <p className="text-[11px] text-text-muted">
                      Operadora {detailLine.carrier}{detailLine.planName ? ` · ${detailLine.planName}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailLine(null)}
                  className="text-text-muted hover:text-text-primary p-1.5 radius-base hover:bg-surface-subtle transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-surface-subtle radius-base text-[11px]">
                <div>
                  <span className="text-text-muted block">Status da Linha</span>
                  <StatusBadge status={detailLine.status} type="line" />
                </div>
                <div>
                  <span className="text-text-muted block">Custo Mensal</span>
                  <span className="font-code font-bold text-text-primary">{formatCurrency(detailLine.monthlyCost)}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Data de Ativação</span>
                  <span className="text-text-primary">{formatDate(detailLine.activationDate)}</span>
                </div>
                <div>
                  <span className="text-text-muted block">ICCID (Chip)</span>
                  <span className="font-code text-text-primary">{detailLine.iccid || 'Não registrado'}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Aparelho Associado</span>
                  <span className="font-semibold text-text-primary">{detailLine.associatedDeviceTag || 'Nenhum'}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Responsável Atual</span>
                  <span className="font-semibold text-text-primary">{detailLine.currentCollaboratorName || 'Sem responsável'}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Unidade</span>
                  <span className="font-semibold text-text-primary">{detailLine.unit || 'Não informada'}</span>
                </div>
              </div>

              {detailLine.notes && (
                <div className="text-[11px] p-3 radius-base bg-surface-subtle text-text-muted">
                  <span className="font-semibold block mb-0.5">Observações:</span>
                  {detailLine.notes}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-border-subtle">
                <Button variant="ghost" size="sm" onClick={() => setDetailLine(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
