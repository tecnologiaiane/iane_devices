import React, { useEffect, useRef, useState } from 'react';
import { Movement, MovementType, DocumentTerm, RequestRecord, User as UserRecord } from '../types';
import { dataService, isStockCustody, stockDisplayName } from '../services/dataStorage';
import { apiClient } from '../services/apiClient';
import { formatDate, formatDateTime } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import {
  ArrowLeftRight,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Eye,
  CheckCircle2,
  Calendar,
  X,
  ShieldCheck,
  User,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { OfficialFlowType } from '../components/modals/MovementModal';
import { canAccessRequests, canApproveRequests } from '../config/requestAccess';
import { Modal } from '../components/Modal';
import { Button } from '../components/button';
import { Badge } from '../components/badge';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { FilterDropdown, FilterField, FilterTrigger } from '../components/FilterDropdown';
import { RequestDetailsModal } from './RequestsView';
import { useToast } from '../components/ToastProvider';

const MOVEMENT_FLOWS: { flow: OfficialFlowType; label: string }[] = [
  { flow: 'entrega', label: 'Entrega' },
  { flow: 'devolucao', label: 'Devolução' },
  { flow: 'transferencia', label: 'Transferência' },
  { flow: 'troca', label: 'Troca de Aparelho' },
];

interface MovementsViewProps {
  onOpenMovementModal: (flow?: OfficialFlowType) => void;
  onViewTerm: (term: DocumentTerm) => void;
  currentUser: UserRecord;
  onApproveRequest: (request: RequestRecord) => void;
}

export const MovementsView: React.FC<MovementsViewProps> = ({
  onOpenMovementModal,
  onViewTerm,
  currentUser,
  onApproveRequest,
}) => {
  const toast = useToast();
  const [movements, setMovements] = useState<Movement[]>(dataService.getMovements());
  const [devices] = useState(() => dataService.getDevices());
  const deviceModelById = new Map(devices.map((device) => [device.id, device.model]));
  const movementDeviceModel = (movement: Movement) =>
    (movement.deviceId ? deviceModelById.get(movement.deviceId) : undefined) || movement.deviceName || '';
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLButtonElement>(null);
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageSizes = [10, 25, 50, 100];

  // Selected movement for detail
  const [detailMovement, setDetailMovement] = useState<Movement | null>(null);
  const [isMovementMenuOpen, setIsMovementMenuOpen] = useState(false);
  const [allRequests, setAllRequests] = useState<RequestRecord[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestRecord[]>([]);
  const [requestToView, setRequestToView] = useState<RequestRecord | null>(null);
  const [requestToReject, setRequestToReject] = useState<RequestRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [requestError, setRequestError] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const canApprove = canApproveRequests(currentUser.role);

  useEffect(() => {
    if (!canAccessRequests(currentUser.role)) return;
    dataService.fetchRequests().then((requests) => {
      setAllRequests(requests);
      if (canApprove) {
        setPendingRequests(requests.filter((request) => (request.status || 'Pendente de aprovação') === 'Pendente de aprovação'));
      }
    });
  }, [canApprove, currentUser.role]);

  useEffect(() => {
    if (!isFilterMenuOpen || !filterMenuRef.current) {
      setFilterPosition(null);
      return;
    }
    const rect = filterMenuRef.current.getBoundingClientRect();
    setFilterPosition({ top: rect.bottom + 4, left: rect.left });
  }, [isFilterMenuOpen]);

  // Fecha o dropdown de filtros ao clicar fora ou pressionar Esc
  useEffect(() => {
    if (!isFilterMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFilterMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterMenuOpen]);

  const confirmRejection = async () => {
    if (!requestToReject || isRejecting) return;
    setIsRejecting(true);
    setRequestError('');
    const result = await dataService.rejectRequest(requestToReject.id, rejectionReason);
    setIsRejecting(false);
    if (!result.success) {
      toast.error(result.message || 'Não foi possível salvar. Tente novamente.');
      return;
    }
    toast.success(`Solicitação de ${requestToReject.requesterName} recusada.`);
    setPendingRequests((requests) => requests.filter((request) => request.id !== requestToReject.id));
    setRequestToReject(null);
    setRejectionReason('');
  };

  const requestCollaborator = (request: RequestRecord) => {
    const data = request.data || {};
    if (request.type === 'Entrega') return data.employeeName || '—';
    if (request.type === 'Transferência') return `${data.originCollaboratorName || 'Origem'} → ${data.destinationCollaboratorName || 'Destino'}`;
    return data.collaboratorName || '—';
  };

  const approvalByMovementId = new Map<string, NonNullable<Movement['requestApproval']>>();
  for (const request of allRequests) {
    if (request.status !== 'Aprovada' || !request.movementIds?.length) continue;
    const approval = {
      requestId: request.id,
      requestType: request.type,
      requesterName: request.requesterName,
      requestedAt: request.createdAt,
      approverName: request.decidedByName || '—',
      approvedAt: request.decidedAt || '',
      primaryMovementId: request.movementIds[0],
    };
    request.movementIds.forEach((movementId) => approvalByMovementId.set(movementId, approval));
  }
  const requestApprovalFor = (movement: Movement) => movement.requestApproval || approvalByMovementId.get(movement.id);
  const historyMovements = movements.filter((movement) => {
    const approval = requestApprovalFor(movement);
    return !approval || movement.id === approval.primaryMovementId;
  });

  const filteredMovements = historyMovements.filter((m) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = m.code.toLowerCase().includes(q);
      const matchBatch = m.batchOperationId?.toLowerCase().includes(q) || false;
      const matchDevice = m.deviceTag?.toLowerCase().includes(q) || false;
      const matchName = m.deviceName?.toLowerCase().includes(q) || false;
      const matchLine = m.phoneNumber?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || false;
      const matchDest = stockDisplayName(m.destinationCollaboratorName).toLowerCase().includes(q);
      const matchOrig = stockDisplayName(m.originCollaboratorName).toLowerCase().includes(q);
      const matchReason = m.reason?.toLowerCase().includes(q) || false;
      const matchTerm = m.linkedTerms?.some((term) => term.code.toLowerCase().includes(q)) || m.documentCode?.toLowerCase().includes(q) || false;
      if (!matchCode && !matchBatch && !matchDevice && !matchName && !matchLine && !matchDest && !matchOrig && !matchReason && !matchTerm) {
        return false;
      }
    }

    if (typeFilter !== 'todos' && !m.type.toLowerCase().includes(typeFilter.toLowerCase())) return false;
    if (startDate && m.date < startDate) return false;
    if (endDate && m.date > endDate) return false;

    return true;
  });

  const totalPages = Math.ceil(filteredMovements.length / pageSize) || 1;
  const paginatedMovements = filteredMovements.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOpenLinkedTerm = (termId?: string) => {
    if (!termId) return;
    const term = dataService.getTermById(termId);
    if (term) {
      onViewTerm(term);
    } else {
      apiClient.notify({
        type: 'warning',
        title: 'Documento não localizado',
        message: 'Documento não localizado no arquivo digital.',
      });
    }
  };

  /** Colunas da tabela de solicitações pendentes (primeira tabela, dentro de card com borda). */
  const pendingColumns: DataTableColumn<RequestRecord>[] = [
    {
      key: 'date',
      header: 'Data da solicitação',
      render: (req) => formatDateTime(req.createdAt),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (req) => req.type,
    },
    {
      key: 'requester',
      header: 'Solicitante',
      render: (req) => req.requesterName,
    },
    {
      key: 'collaborator',
      header: 'Colaborador/funcionário',
      render: (req) => requestCollaborator(req),
    },
    {
      key: 'actions',
      header: 'Ação',
      headerClassName: 'text-right',
      cellClassName: 'text-right whitespace-nowrap',
      render: (req) => (
        <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            title="Visualizar"
            onClick={() => setRequestToView(req)}
            className="inline-flex items-center gap-1 px-2 py-1 radius-base text-text-muted hover:bg-surface-subtle hover:text-text-primary transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            title="Aprovar"
            onClick={() => onApproveRequest(req)}
            className="ml-1 inline-flex items-center gap-1 px-2 py-1 radius-base text-status-success-fg hover:bg-status-success-bg transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />Aprovar
          </button>
          <button
            title="Recusar"
            onClick={() => { setRequestError(''); setRejectionReason(''); setRequestToReject(req); }}
            className="ml-1 inline-flex items-center gap-1 px-2 py-1 radius-base text-status-danger-fg hover:bg-status-danger-bg transition-colors"
          >
            Recusar
          </button>
        </div>
      ),
    },
  ];

  /** Colunas da tabela principal de movimentações (segunda tabela). */
  const movementsColumns: DataTableColumn<Movement>[] = [
    {
      key: 'code',
      header: 'Código / Data',
      cellClassName: 'whitespace-nowrap',
      render: (mov) => (
        <>
          <span className="font-code font-bold text-text-primary block">{mov.code}</span>
          <span className="text-[11px] font-code text-text-muted">{formatDate(mov.date)}</span>
          {mov.batchOperationId && (
            <span className="text-[10px] font-code text-brand-blue-action bg-surface-subtle px-1.5 py-0.2 rounded border border-border-subtle mt-0.5 inline-block">
              {mov.batchOperationId}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'type',
      header: 'Operação Oficial',
      render: (mov) => (
        <>
          <span className="font-medium text-text-primary block">{mov.type}</span>
          {mov.stockTransit?.stage && (
            <span className="text-[10px] text-brand-blue-action font-medium">
              {mov.stockTransit.stage}
            </span>
          )}
          {requestApprovalFor(mov) && (
            <span className="mt-1 inline-block"><StatusBadge status="Via solicitação" type="request" /></span>
          )}
        </>
      ),
    },
    {
      key: 'flow',
      header: 'Fluxo Patrimonial',
      render: (mov) => (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className={`px-1.5 py-0.5 rounded ${isStockCustody(mov.originCollaboratorName) ? 'bg-surface-subtle text-brand-navy-base font-bold' : 'text-text-primary font-medium'}`}>
            {stockDisplayName(mov.originCollaboratorName)}
          </span>
          <ArrowRight className="w-3 h-3 text-border-strong shrink-0" />
          <span className={`px-1.5 py-0.5 rounded ${isStockCustody(mov.destinationCollaboratorName) ? 'bg-surface-subtle text-brand-navy-base font-bold' : 'text-text-primary font-medium'}`}>
            {stockDisplayName(mov.destinationCollaboratorName)}
          </span>
        </div>
      ),
    },
    {
      key: 'device',
      header: 'Aparelho Envolvido',
      render: (mov) => (mov.deviceTag ? (
        <>
          <span className="font-code font-bold text-brand-blue-action">{mov.deviceTag}</span>
          <span className="block text-[11px] text-text-muted truncate max-w-[150px]">{movementDeviceModel(mov)}</span>
        </>
      ) : (
        <span className="text-text-muted italic font-body">Nenhum</span>
      )),
    },
    {
      key: 'reason',
      header: 'Motivo / Condição',
      cellClassName: 'max-w-[200px]',
      render: (mov) => (
        <>
          <p className="text-text-muted truncate">{mov.reason || 'Movimentação patrimonial regular'}</p>
          {mov.conditionAtMovement && (
            <span className="inline-block mt-0.5">
              <StatusBadge status={mov.conditionAtMovement} type="condition" size="sm" />
            </span>
          )}
        </>
      ),
    },
    {
      key: 'term',
      header: 'Termo',
      render: (mov) => (mov.documentId ? (
        <button
          title="Ver Termo"
          onClick={() => handleOpenLinkedTerm(mov.documentId)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 radius-base text-xs font-medium text-brand-blue-action bg-surface-subtle border border-border-subtle hover:bg-surface-card transition-colors"
        >
          <FileText className="w-3 h-3 text-brand-blue-action" />
          <span>{mov.documentCode || 'Ver Termo'}</span>
        </button>
      ) : (
        <span className="text-text-muted italic text-[11px] font-body">Sem termo anexado</span>
      )),
    },
    {
      key: 'actions',
      header: 'Ação',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (mov) => (
        <button
          title="Visualizar Detalhes"
          onClick={() => setDetailMovement(mov)}
          className="p-1.5 text-text-muted hover:text-brand-blue-action hover:bg-surface-subtle radius-base transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {canApprove && (
        <section className="radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Solicitações pendentes</h2>
              <Badge variant="warning" size="sm" showDot className="text-[11px]">
                {pendingRequests.length}
              </Badge>
            </div>
          </div>
          {pendingRequests.length > 0 ? (
            <DataTable
              caption="Solicitações pendentes de aprovação"
              columns={pendingColumns}
              rows={pendingRequests}
              rowKey={(req) => req.id}
              bordered={false}
            />
          ) : <p className="px-4 py-5 text-center text-[11px] text-text-muted">Não há solicitações pendentes.</p>}
        </section>
      )}

      {/* Search and Filters */}
      <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código (MOV-... ou TRF-...), aparelho, linha ou colaborador..."
              className="w-full h-9 pl-9 pr-3 text-xs field"
            />
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsMovementMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isMovementMenuOpen}
              className="inline-flex items-center gap-1.5 px-3 py-2 radius-lg text-xs font-medium text-brand-blue-action bg-surface-subtle border border-border-subtle hover:bg-surface-card transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Movimentação</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {isMovementMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMovementMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-surface-card border border-border-subtle shadow-lg z-20 py-1 text-left">
                  {MOVEMENT_FLOWS.map((option) => (
                    <button
                      key={option.flow}
                      type="button"
                      onClick={() => { setIsMovementMenuOpen(false); onOpenMovementModal(option.flow); }}
                      className="w-full px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-subtle transition-colors text-left"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between w-full pt-2 border-t border-border-subtle text-xs">
          <div className="flex items-center gap-1 text-text-muted">
            <span className="text-[11px]">Exibindo</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{Math.min(currentPage * pageSize, filteredMovements.length)}</span>
            <span className="text-[11px]">de</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{filteredMovements.length}</span>
            <span className="text-[11px]">movimentações</span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <FilterTrigger
              ref={filterMenuRef}
              isOpen={isFilterMenuOpen}
              activeCount={[typeFilter !== 'todos', Boolean(startDate), Boolean(endDate)].filter(Boolean).length}
              onToggle={() => setIsFilterMenuOpen((open) => !open)}
            />
            <FilterDropdown
              isOpen={isFilterMenuOpen}
              position={filterPosition}
              activeCount={[typeFilter !== 'todos', Boolean(startDate), Boolean(endDate)].filter(Boolean).length}
              onClose={() => setIsFilterMenuOpen(false)}
              onClear={() => {
                setTypeFilter('todos');
                setStartDate('');
                setEndDate('');
              }}
            >
              <FilterField
                label="Tipo"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { label: 'Entrega (Estoque → Colaborador)', value: 'Entrega' },
                  { label: 'Devolução (Colaborador → Estoque)', value: 'Devolução' },
                  { label: 'Transferências (A → Estoque → B)', value: 'Transferência' },
                  { label: 'Trocas de Aparelho', value: 'Troca' },
                  { label: 'Liberação de Estoque', value: 'Liberação de Estoque' },
                  { label: 'Manutenção', value: 'Manutenção' },
                ]}
              />
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted">De</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-9 text-xs field px-2.5 py-1.5 font-code"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted">Até</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-9 text-xs field px-2.5 py-1.5 font-code"
                />
              </div>
            </FilterDropdown>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-text-muted">Por página:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-auto h-9 text-[11px] field px-2 py-1 font-medium"
              >
                {pageSizes.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        caption="Histórico de movimentações"
        columns={movementsColumns}
        rows={paginatedMovements}
        rowKey={(mov) => mov.id}
        onRowClick={setDetailMovement}
        empty={
          <div className="p-10 text-center text-text-muted">
            <ArrowLeftRight className="w-10 h-10 text-border-strong mx-auto mb-2" />
            <p className="font-semibold text-text-primary">Nenhuma movimentação encontrada</p>
          </div>
        }
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <span>Página {currentPage} de {totalPages}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {detailMovement && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-brand-navy-dark/45 backdrop-blur-sm" onClick={() => setDetailMovement(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-surface-card radius-lg border border-border-subtle shadow-lg w-full max-w-2xl overflow-hidden p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 radius-base bg-brand-blue-action text-white flex items-center justify-center font-bold">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-text-primary font-code">
                        {detailMovement.code}
                      </h2>
                      <span className="text-[11px] font-medium px-2 py-0.5 radius-base bg-surface-subtle text-text-primary border border-border-subtle">
                        {detailMovement.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted">
                      Registrado em {formatDate(detailMovement.date)} por {detailMovement.registeredBy}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailMovement(null)}
                  className="text-text-muted hover:text-text-primary p-1.5 radius-base hover:bg-surface-subtle transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {requestApprovalFor(detailMovement) && (
                <div className="grid grid-cols-2 gap-3 radius-base border border-border-subtle bg-surface-subtle p-3 text-[11px]">
                  <div><span className="block text-text-muted">Solicitação de</span><strong className="text-text-primary">{requestApprovalFor(detailMovement)?.requestType}</strong></div>
                  <div><span className="block text-text-muted">Solicitante</span><strong className="text-text-primary">{requestApprovalFor(detailMovement)?.requesterName}</strong></div>
                  <div><span className="block text-text-muted">Data da solicitação</span><strong className="text-text-primary">{formatDateTime(requestApprovalFor(detailMovement)?.requestedAt || '')}</strong></div>
                  <div><span className="block text-text-muted">Aprovador</span><strong className="text-text-primary">{requestApprovalFor(detailMovement)?.approverName}</strong></div>
                  <div><span className="block text-text-muted">Data da aprovação</span><strong className="text-text-primary">{formatDateTime(requestApprovalFor(detailMovement)?.approvedAt || '')}</strong></div>
                </div>
              )}

              {/* Rota Oficial com Estoque */}
              <div className="p-3 radius-base border border-brand-blue-action/20 bg-brand-blue-action/10 text-[11px] space-y-1">
                <span className="font-medium text-brand-navy-base block">Fluxo de Custódia Patrimonial:</span>
                <div className="flex items-center gap-2 font-bold text-brand-navy-base">
                  <span>{stockDisplayName(detailMovement.originCollaboratorName)}</span>
                  <ArrowRight className="w-4 h-4 text-brand-blue-action" />
                  <span>{stockDisplayName(detailMovement.destinationCollaboratorName)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 radius-base bg-surface-subtle text-[11px]">
                <div>
                  <span className="text-text-muted block">Aparelho Envolvido</span>
                  <span className="font-semibold text-text-primary font-code">
                    {detailMovement.deviceTag || 'N/A'} {movementDeviceModel(detailMovement) ? `(${movementDeviceModel(detailMovement)})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Linha Telefônica</span>
                  <span className="font-code text-text-primary">{detailMovement.phoneNumber || 'Nenhuma'}</span>
                </div>
                {detailMovement.batchOperationId && (
                  <div>
                    <span className="text-text-muted block">Operação Conjunta</span>
                    <span className="font-code font-bold text-brand-blue-action">{detailMovement.batchOperationId}</span>
                  </div>
                )}
                {detailMovement.conditionAtMovement && (
                  <div>
                    <span className="text-text-muted block">Estado de Conservação</span>
                    <StatusBadge status={detailMovement.conditionAtMovement} type="condition" size="sm" />
                  </div>
                )}
              </div>

              {detailMovement.accessoriesIncluded && detailMovement.accessoriesIncluded.length > 0 && (
                <div>
                  <span className="text-[11px] font-medium text-text-muted block mb-1">
                    Itens e Acessórios Concomitantes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {detailMovement.accessoriesIncluded.map((acc, idx) => (
                      <span key={idx} className="text-[11px] px-2.5 py-1 radius-base border border-border-subtle bg-surface-subtle text-text-muted">
                        ✓ {acc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detailMovement.reason && (
                <div className="text-[11px] bg-surface-subtle p-3 radius-base border border-border-subtle text-text-muted">
                  <span className="font-medium block mb-0.5">Motivo / Justificativa:</span>
                  {detailMovement.reason}
                </div>
              )}

              {(detailMovement.linkedTerms?.length || detailMovement.documentId) && (
                <div className="p-3 radius-base border border-brand-blue-action/20 bg-brand-blue-action/10 space-y-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-blue-action" />
                    <span className="font-medium text-brand-navy-base">Documentos vinculados</span>
                  </div>
                  {(detailMovement.linkedTerms?.length ? detailMovement.linkedTerms : [{ id: detailMovement.documentId!, code: detailMovement.documentCode || 'Termo', type: detailMovement.documentType! }]).map((term) => (
                    <div key={term.id} className="flex items-center justify-between gap-3 border-t border-border-subtle pt-2">
                      <span className="min-w-0 truncate text-text-primary"><strong className="text-text-primary">{term.code}</strong> · {term.type}</span>
                      <button
                        onClick={() => {
                          setDetailMovement(null);
                          handleOpenLinkedTerm(term.id);
                        }}
                        className="shrink-0 radius-base bg-brand-blue-action px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-brand-blue-action-hover"
                      >Abrir Termo</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-border-subtle">
                <Button variant="ghost" size="sm" onClick={() => setDetailMovement(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {requestToView && <RequestDetailsModal request={requestToView} onClose={() => setRequestToView(null)} />}
      {requestToReject && (
        <Modal isOpen onClose={() => { if (!isRejecting) setRequestToReject(null); }} title="Recusar solicitação" subtitle={`${requestToReject.type} · ${requestToReject.requesterName}`} maxWidth="md">
          <div className="space-y-4">
            {requestError && <p role="alert" className="rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger-fg">{requestError}</p>}
            <label className="block text-[11px] font-medium text-text-muted">
              Motivo da recusa (opcional)
              <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} className="mt-1 w-full field px-3 py-2" />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRequestToReject(null)} disabled={isRejecting}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={() => void confirmRejection()} disabled={isRejecting}>
                {isRejecting ? 'Recusando...' : 'Confirmar recusa'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
