import React, { useEffect, useState } from 'react';
import { Movement, MovementType, DocumentTerm, RequestRecord, User as UserRecord } from '../types';
import { dataService, STOCK_LABEL } from '../services/dataStorage';
import { formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import {
  ArrowLeftRight,
  Search,
  Filter,
  ChevronDown,
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
import { canAccessRequests, canApproveRequests } from '../config/requestAccess';
import { Modal } from '../components/Modal';
import { formatDateTime } from '../utils/formatters';
import { RequestDetailsModal } from './RequestsView';

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
  const [movements, setMovements] = useState<Movement[]>(dataService.getMovements());
  const [devices] = useState(() => dataService.getDevices());
  const deviceModelById = new Map(devices.map((device) => [device.id, device.model]));
  const movementDeviceModel = (movement: Movement) =>
    (movement.deviceId ? deviceModelById.get(movement.deviceId) : undefined) || movement.deviceName || '';
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  const confirmRejection = async () => {
    if (!requestToReject || isRejecting) return;
    setIsRejecting(true);
    setRequestError('');
    const result = await dataService.rejectRequest(requestToReject.id, rejectionReason);
    setIsRejecting(false);
    if (!result.success) {
      setRequestError(result.message);
      return;
    }
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
      {canApprove && (
        <section className="bg-white rounded-xl border border-ink-200 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-ink-900">Solicitações pendentes</h2>
              <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-sun-400 px-1.5 text-[10px] font-bold text-navy-900">{pendingRequests.length}</span>
            </div>
          </div>
          {pendingRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-ink-50 border-b border-ink-200 text-ink-600 uppercase font-semibold tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Data da solicitação</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Solicitante</th>
                    <th className="py-3 px-4">Colaborador/funcionário</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {pendingRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-ink-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">{formatDateTime(request.createdAt)}</td>
                      <td className="py-3 px-4 font-semibold">{request.type}</td>
                      <td className="py-3 px-4">{request.requesterName}</td>
                      <td className="py-3 px-4">{requestCollaborator(request)}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button type="button" onClick={() => setRequestToView(request)} className="inline-flex items-center gap-1 px-2 py-1 text-ink-600 hover:text-iane-700 rounded-md hover:bg-iane-50"><Eye className="h-3.5 w-3.5" />Visualizar</button>
                        <button type="button" onClick={() => onApproveRequest(request)} className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-emerald-700 hover:bg-emerald-50 rounded-md"><CheckCircle2 className="h-3.5 w-3.5" />Aprovar</button>
                        <button type="button" onClick={() => { setRequestError(''); setRejectionReason(''); setRequestToReject(request); }} className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-rose-700 hover:bg-rose-50 rounded-md">Recusar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="px-4 py-5 text-center text-xs text-ink-500">Não há solicitações pendentes.</p>}
        </section>
      )}

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

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsMovementMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isMovementMenuOpen}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-iane-700 bg-iane-50 hover:bg-iane-100 border border-iane-200 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Movimentação</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {isMovementMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMovementMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-white border border-ink-200 rounded-lg shadow-lg z-20 py-1 text-left">
                  {MOVEMENT_FLOWS.map((option) => (
                    <button
                      key={option.flow}
                      type="button"
                      onClick={() => { setIsMovementMenuOpen(false); onOpenMovementModal(option.flow); }}
                      className="w-full px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 hover:text-iane-700 transition-colors text-left"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
            Exibindo <strong>{filteredMovements.length}</strong> de <strong>{historyMovements.length}</strong> movimentações
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
                <th className="py-3 px-4">Termo</th>
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
                    {requestApprovalFor(mov) && (
                      <span className="mt-1 inline-block"><StatusBadge status="Via solicitação" type="request" /></span>
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
                        <span className="block text-[11px] text-ink-500 truncate max-w-[150px]">{movementDeviceModel(mov)}</span>
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

              {requestApprovalFor(detailMovement) && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-iane-200 bg-iane-50/60 p-3 text-xs">
                  <div><span className="block text-[11px] text-ink-500">Solicitação de</span><strong>{requestApprovalFor(detailMovement)?.requestType}</strong></div>
                  <div><span className="block text-[11px] text-ink-500">Solicitante</span><strong>{requestApprovalFor(detailMovement)?.requesterName}</strong></div>
                  <div><span className="block text-[11px] text-ink-500">Data da solicitação</span><strong>{formatDateTime(requestApprovalFor(detailMovement)?.requestedAt || '')}</strong></div>
                  <div><span className="block text-[11px] text-ink-500">Aprovador</span><strong>{requestApprovalFor(detailMovement)?.approverName}</strong></div>
                  <div><span className="block text-[11px] text-ink-500">Data da aprovação</span><strong>{formatDateTime(requestApprovalFor(detailMovement)?.approvedAt || '')}</strong></div>
                </div>
              )}

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
                    {detailMovement.deviceTag || 'N/A'} {movementDeviceModel(detailMovement) ? `(${movementDeviceModel(detailMovement)})` : ''}
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
                      <span className="text-iane-700 block text-[11px]">Termo gerado nesta operação</span>
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
                    Abrir Termo
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

      {requestToView && <RequestDetailsModal request={requestToView} onClose={() => setRequestToView(null)} />}
      {requestToReject && (
        <Modal isOpen onClose={() => { if (!isRejecting) setRequestToReject(null); }} title="Recusar solicitação" subtitle={`${requestToReject.type} · ${requestToReject.requesterName}`} maxWidth="md">
          <div className="space-y-4">
            {requestError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{requestError}</p>}
            <label className="block text-xs font-medium text-ink-700">
              Motivo da recusa (opcional)
              <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs text-ink-800" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRequestToReject(null)} disabled={isRejecting} className="rounded-lg bg-ink-100 px-4 py-2 text-xs font-medium text-ink-700 hover:bg-ink-200">Cancelar</button>
              <button type="button" onClick={() => void confirmRejection()} disabled={isRejecting} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{isRejecting ? 'Recusando...' : 'Confirmar recusa'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
