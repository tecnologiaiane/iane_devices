import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Catalogs, Collaborator, Device, PhoneLine, RequestRecord, RequestType, User } from '../types';
import { dataService } from '../services/dataStorage';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/button';
import { Badge } from '../components/badge';
import { formatDate, formatDateTime, formatPhone, matchesPhoneSearch } from '../utils/formatters';
import { toDateInputValue } from '../utils/dates';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  Info,
  Package,
  Plus,
  Search,
  Smartphone,
  UserRound,
  Eye,
  X,
} from 'lucide-react';

type RequestFlow = 'entrega' | 'devolucao' | 'transferencia' | 'troca';

const FLOW_OPTIONS: { flow: RequestFlow; label: RequestType }[] = [
  { flow: 'entrega', label: 'Entrega' },
  { flow: 'devolucao', label: 'Devolução' },
  { flow: 'transferencia', label: 'Transferência' },
  { flow: 'troca', label: 'Troca de Aparelho' },
];

const ACCESSORIES = [
  'Carregador Original',
  'Cabo USB-C / Lightning',
  'Capa Protetora Anti-Impacto',
  'Película de Vidro Aplicada',
  'Chave Ejetora de Chip (SIM)',
  'Embalagem / Caixa Original',
  'Fone de Ouvido Corporativo',
];

function extractLineDdd(phoneNumber: string): string {
  let digits = String(phoneNumber || '').replace(/\D/g, '');
  if (digits.startsWith('0055')) digits = digits.slice(4);
  else if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.replace(/^0+/, '');
  return digits.length >= 10 ? digits.slice(0, 2) : '';
}

interface RequestsViewProps {
  currentUser: User;
}

interface SearchOption {
  id: string;
  label: string;
  phone?: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchOption[];
  placeholder: string;
  onChange: (value: string) => void;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ value, options, placeholder, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isEditingQueryRef = useRef(false);
  const selected = options.find((option) => option.id === value);
  const visibleOptions = options.filter((option) =>
    option.label.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')) ||
    (option.phone ? matchesPhoneSearch(option.phone, query) : false)
  );

  useEffect(() => {
    if (isEditingQueryRef.current) {
      isEditingQueryRef.current = false;
      return;
    }
    setQuery(selected?.label || '');
  }, [selected?.id, selected?.label]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          isEditingQueryRef.current = true;
          setQuery(event.target.value);
          onChange('');
          setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full h-10 text-xs radius-base border border-border-subtle bg-surface-card px-3 py-2 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
      />
      {open && (
        <div role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto radius-lg border border-border-subtle bg-surface-card py-1 shadow-md">
          {visibleOptions.length > 0 ? visibleOptions.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.id === value}
              key={option.id}
              onClick={() => {
                isEditingQueryRef.current = false;
                onChange(option.id);
                setQuery(option.label);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-surface-subtle ${option.id === value ? 'bg-surface-subtle font-semibold text-brand-navy-base' : 'text-text-primary'}`}
            >
              {option.label}
            </button>
          )) : (
            <p className="px-3 py-2 text-[11px] text-text-muted">Nenhum resultado encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
};

function storedDeviceModel(data: Record<string, any>, nameKey: string, idKey: string): string {
  const device = data?.[idKey] ? dataService.getDevices().find((item) => item.id === data[idKey]) : undefined;
  return device?.model || String(data?.[nameKey] || '');
}

function getRequestDetails(request: RequestRecord): string[] {
  const data = request.data || {};
  if (request.type === 'Entrega') {
    return [
      data.employeeName,
      data.position,
      data.deliveryDate && `Data de entrega: ${formatDate(data.deliveryDate)}`,
      data.isNewLine === 'Sim' ? 'Linha nova' : data.lineNumber,
      data.lineCarrier && `Operadora: ${data.lineCarrier}`,
    ].filter(Boolean);
  }
  if (request.type === 'Devolução') {
    return [
      data.collaboratorName,
      data.devices?.map((item: any) => `${item.assetTag} ${item.model}`.trim()).join(', ') || 'Nenhum aparelho',
      data.lines?.map((item: any) => item.phoneNumber).join(', ') || 'Nenhuma linha',
      data.plannedReturnDate && `Devolução prevista: ${data.plannedReturnDate}`,
    ].filter(Boolean);
  }
  if (request.type === 'Transferência') {
    return [
      `${data.originCollaboratorName || 'Origem'} → ${data.destinationCollaboratorName || 'Destino'}`,
      `${data.deviceTag || ''} ${storedDeviceModel(data, 'deviceName', 'deviceId')}`.trim(),
      data.reason,
    ].filter(Boolean);
  }
  return [
    data.collaboratorName,
    `${data.oldDeviceTag || ''} ${storedDeviceModel(data, 'oldDeviceName', 'oldDeviceId')} → ${data.newDeviceTag || ''} ${storedDeviceModel(data, 'newDeviceName', 'newDeviceId')}`.trim(),
    data.reason,
  ].filter(Boolean);
}

export const RequestsView: React.FC<RequestsViewProps> = ({ currentUser }) => {
  const [requests, setRequests] = useState<RequestRecord[]>(() => dataService.getRequests());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeFlow, setActiveFlow] = useState<RequestFlow | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageSizes = [10, 25, 50, 100];

  useEffect(() => {
    let mounted = true;
    dataService.fetchRequests()
      .then((records) => { if (mounted) setRequests(records); })
      .catch(() => { if (mounted) setLoadError('Não foi possível carregar as solicitações.'); });
    return () => { mounted = false; };
  }, [currentUser.id]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [menuOpen]);

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

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return requests
      .filter((request) => {
        if (typeFilter !== 'todos' && request.type !== typeFilter) return false;
        if (statusFilter !== 'todos' && request.status !== statusFilter) return false;
        const requestDate = toDateInputValue(request.createdAt);
        if (startDate && requestDate < startDate) return false;
        if (endDate && requestDate > endDate) return false;
        if (!query) return true;
        return [request.type, request.requesterName, ...getRequestDetails(request)]
          .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(query));
      })
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }, [requests, search, typeFilter, statusFilter, startDate, endDate]);

  const totalPages = Math.ceil(visibleRequests.length / pageSize) || 1;
  const paginatedRequests = visibleRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCreated = (request: RequestRecord) => {
    setRequests((previous) => [request, ...previous.filter((item) => item.id !== request.id)]);
    setSuccessMessage('Solicitação registrada com sucesso.');
    setActiveFlow(null);
  };

  const resetFilters = () => {
    setTypeFilter('todos');
    setStatusFilter('todos');
    setStartDate('');
    setEndDate('');
    setSearch('');
  };

  return (
    <div className="space-y-5">
      {successMessage && (
        <div role="status" className="flex items-center justify-between gap-3 radius-lg border border-status-success-border bg-status-success-bg p-3 text-xs text-status-success-fg">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} aria-label="Fechar mensagem" className="radius-base p-1 text-status-success-fg hover:bg-surface-subtle transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {loadError && <p role="alert" className="rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger-fg">{loadError}</p>}

      <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por tipo, solicitante, colaborador ou detalhes..."
              className="w-full pl-9 pr-3 py-2 text-xs radius-base border border-border-subtle bg-surface-card placeholder-text-muted text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
            />
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <Button variant="primary" size="sm" onClick={() => setMenuOpen((open) => !open)} className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Nova solicitação <ChevronDown className="w-3.5 h-3.5" />
            </Button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden radius-lg border border-border-subtle bg-surface-card py-1 shadow-md">
                {FLOW_OPTIONS.map((option) => (
                  <button
                    key={option.flow}
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setActiveFlow(option.flow); }}
                    className="block w-full px-3 py-2 text-xs text-text-primary hover:bg-surface-subtle transition-colors text-left"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          ref={filterMenuRef}
          className="relative"
        >
          <button
            type="button"
            onClick={() => setIsFilterMenuOpen((open) => !open)}
            aria-expanded={isFilterMenuOpen}
            aria-haspopup="menu"
            className="inline-flex items-center gap-2 radius-lg border border-border-subtle bg-surface-card px-2.5 py-1 text-text-muted font-medium focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
          >
            <Filter className="w-3 h-3 text-text-muted" />
            <span>Filtros</span>
            {(
              typeFilter !== 'todos' ||
              statusFilter !== 'todos' ||
              startDate ||
              endDate
            ) && (
              <Badge variant="info" size="sm" className="text-[10px]">
                ativos
              </Badge>
            )}
          </button>

          {isFilterMenuOpen && (
            <div
              className="absolute z-40 mt-1 w-80 overflow-hidden radius-lg border border-border-subtle bg-surface-card shadow-lg py-2"
            >
              <div className="px-3 py-2 space-y-3 border-b border-border-subtle pb-2">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Tipo</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full h-9 text-xs radius-base border border-border-subtle bg-surface-card px-2 py-1 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
                  >
                    <option value="todos">Todos</option>
                    <option value="Entrega">Entrega</option>
                    <option value="Devolução">Devolução</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Troca">Troca de Aparelho</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full h-9 text-xs radius-base border border-border-subtle bg-surface-card px-2 py-1 text-text-primary focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
                  >
                    <option value="todos">Todos</option>
                    <option value="Pendente de aprovação">Pendente de aprovação</option>
                    <option value="Aprovada">Aprovada</option>
                    <option value="Recusada">Recusada</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 text-text-muted">
                  <span className="text-[11px]">De:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="radius-base border border-border-subtle bg-surface-card px-2 py-0.5 text-xs text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
                  />
                </div>

                <div className="flex items-center gap-1 text-text-muted">
                  <span className="text-[11px]">Até:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="radius-base border border-border-subtle bg-surface-card px-2 py-0.5 text-xs text-text-primary font-code focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
                  />
                </div>
              </div>

              <div className="px-3 py-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsFilterMenuOpen(false)}>Fechar</Button>
                {(typeFilter !== 'todos' || statusFilter !== 'todos' || startDate || endDate) && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setTypeFilter('todos');
                    setStatusFilter('todos');
                    setStartDate('');
                    setEndDate('');
                  }}>
                    Limpar filtros
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between w-full pt-2 border-t border-border-subtle text-xs">
          <div className="flex items-center gap-1 text-text-muted">
            <span className="text-[11px]">Exibindo</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{Math.min(currentPage * pageSize, visibleRequests.length)}</span>
            <span className="text-[11px]">de</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{visibleRequests.length}</span>
            <span className="text-[11px]">solicitações</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] text-text-muted">Por página:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-auto h-9 text-[11px] radius-base border border-border-subtle bg-surface-card px-2 py-1 text-text-primary font-medium focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Código / Data</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Solicitante</th>
                <th className="py-3 px-4">Detalhes</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {paginatedRequests.map((request) => (
                <tr key={request.id} className="hover:bg-surface-subtle transition-colors group cursor-pointer" onClick={() => setSelectedRequest(request)}>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-code font-bold text-text-primary block">{request.id}</span>
                    <span className="text-[11px] font-code text-text-muted">{formatDateTime(request.createdAt)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-text-primary block">{request.type}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-text-primary block">{request.requesterName}</span>
                  </td>
                  <td className="py-3 px-4 max-w-[200px]">
                    {getRequestDetails(request).map((detail, i) => (
                      <div key={i} className="text-text-muted truncate">{detail}</div>
                    ))}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={request.status || 'Pendente de aprovação'} type="request" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => setSelectedRequest(request)} className="p-1.5 text-text-muted hover:text-brand-blue-action hover:bg-surface-subtle radius-base transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-text-muted">
                    <ClipboardList className="w-10 h-10 text-border-strong mx-auto mb-2" />
                    <p className="font-semibold text-text-primary">Nenhuma solicitação encontrada</p>
                    <p className="text-[11px] text-text-muted mt-1">Nenhuma solicitação atende aos filtros atuais.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      {selectedRequest && (
        <Modal
          isOpen
          onClose={() => setSelectedRequest(null)}
          title={`Solicitação: ${selectedRequest.id}`}
          subtitle={`${selectedRequest.type} · ${selectedRequest.requesterName}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-surface-subtle radius-base text-[11px]">
              <div>
                <span className="text-text-muted block">Tipo</span>
                <span className="font-medium text-text-primary">{selectedRequest.type}</span>
              </div>
              <div>
                <span className="text-text-muted block">Status</span>
                <StatusBadge status={selectedRequest.status || 'Pendente de aprovação'} type="request" />
              </div>
              <div>
                <span className="text-text-muted block">Data</span>
                <span className="font-code text-text-primary">{formatDateTime(selectedRequest.createdAt)}</span>
              </div>
              <div>
                <span className="text-text-muted block">Solicitante</span>
                <span className="font-medium text-text-primary">{selectedRequest.requesterName}</span>
              </div>
              <div>
                <span className="text-text-muted block">Código</span>
                <span className="font-code text-text-primary">{selectedRequest.id}</span>
              </div>
            </div>

            <div className="p-3 radius-base border border-border-subtle bg-surface-card">
              <span className="text-[11px] font-medium text-text-muted block mb-1">Detalhes</span>
              {getRequestDetails(selectedRequest).map((detail, i) => (
                <div key={i} className="text-[11px] text-text-muted">{detail}</div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-border-subtle">
              <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

interface RequestDetailsModalProps {
  request: RequestRecord;
  onClose: () => void;
}

export const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({
  request,
  onClose,
}) => {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Solicitação: ${request.id}`}
      subtitle={`${request.type} · ${request.requesterName}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-surface-subtle radius-base text-[11px]">
          <div>
            <span className="text-text-muted block">Tipo</span>
            <span className="font-medium text-text-primary">{request.type}</span>
          </div>
          <div>
            <span className="text-text-muted block">Status</span>
            <StatusBadge status={request.status || 'Pendente de aprovação'} type="request" />
          </div>
          <div>
            <span className="text-text-muted block">Data</span>
            <span className="font-code text-text-primary">{formatDateTime(request.createdAt)}</span>
          </div>
          <div>
            <span className="text-text-muted block">Solicitante</span>
            <span className="font-medium text-text-primary">{request.requesterName}</span>
          </div>
          <div>
            <span className="text-text-muted block">Código</span>
            <span className="font-code text-text-primary">{request.id}</span>
          </div>
        </div>

        <div className="p-3 radius-base border border-border-subtle bg-surface-card">
          <span className="text-[11px] font-medium text-text-muted block mb-1">Detalhes</span>
          {getRequestDetails(request).map((detail, i) => (
            <div key={i} className="text-[11px] text-text-muted">{detail}</div>
          ))}
        </div>
      </div>
    </Modal>
  )
};
