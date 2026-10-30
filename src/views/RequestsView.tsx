import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Collaborator, Device, PhoneLine, RequestRecord, RequestType, User } from '../types';
import { dataService } from '../services/dataStorage';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatDateTime, formatPhone } from '../utils/formatters';
import { toDateInputValue } from '../utils/dates';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Filter,
  Info,
  Package,
  Plus,
  Search,
  Smartphone,
  UserRound,
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

const inputClass = 'w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500';
const selectClass = 'w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800';
const disabledClass = 'w-full text-xs rounded-lg border border-ink-300 bg-ink-100 px-3 py-2 text-ink-500 cursor-not-allowed';

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
}

interface SearchableSelectProps {
  value: string;
  options: SearchOption[];
  placeholder: string;
  onChange: (value: string) => void;
}

/** Combobox simples com o mesmo tratamento visual dos campos de formulário existentes. */
const SearchableSelect: React.FC<SearchableSelectProps> = ({ value, options, placeholder, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isEditingQueryRef = useRef(false);
  const selected = options.find((option) => option.id === value);
  const visibleOptions = options.filter((option) =>
    option.label.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
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
        className={inputClass}
      />
      {open && (
        <div role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
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
              className={`block w-full px-3 py-2 text-left text-xs hover:bg-ink-50 ${option.id === value ? 'bg-iane-50 font-semibold text-iane-800' : 'text-ink-700'}`}
            >
              {option.label}
            </button>
          )) : (
            <p className="px-3 py-2 text-xs text-ink-500">Nenhum resultado encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
};

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
      data.devices?.map((item: any) => `${item.assetTag} ${item.brand} ${item.model}`.trim()).join(', ') || 'Nenhum aparelho',
      data.lines?.map((item: any) => item.phoneNumber).join(', ') || 'Nenhuma linha',
      data.plannedReturnDate && `Devolução prevista: ${data.plannedReturnDate}`,
    ].filter(Boolean);
  }
  if (request.type === 'Transferência') {
    return [
      `${data.originCollaboratorName || 'Origem'} → ${data.destinationCollaboratorName || 'Destino'}`,
      `${data.deviceTag || ''} ${data.deviceName || ''}`.trim(),
      data.reason,
    ].filter(Boolean);
  }
  return [
    data.collaboratorName,
    `${data.oldDeviceTag || ''} ${data.oldDeviceName || ''} → ${data.newDeviceTag || ''} ${data.newDeviceName || ''}`.trim(),
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
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} aria-label="Fechar mensagem" className="rounded p-1 text-emerald-700 hover:bg-emerald-100"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {loadError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{loadError}</p>}

      <div className="bg-white p-4 rounded-xl border border-ink-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por tipo, solicitante, colaborador ou detalhes..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-ink-300 bg-white placeholder-ink-400 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nova solicitação <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-xl">
                {FLOW_OPTIONS.map((option) => (
                  <button
                    key={option.flow}
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setActiveFlow(option.flow); }}
                    className="block w-full px-3 py-2 text-left text-xs text-ink-700 hover:bg-ink-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-100 text-xs">
          <span className="text-ink-500 font-medium flex items-center gap-1 mr-1"><Filter className="w-3 h-3 text-ink-400" />Filtros:</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium">
            <option value="todos">Tipo: Todos</option>
            {FLOW_OPTIONS.map((option) => <option key={option.flow} value={option.label}>{option.label}</option>)}
          </select>
          <div className="flex items-center gap-1 text-ink-600">
            <span className="text-[11px]">De:</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-md border border-ink-300 bg-white px-2 py-0.5 text-xs text-ink-700 font-mono" />
          </div>
          <div className="flex items-center gap-1 text-ink-600">
            <span className="text-[11px]">Até:</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-md border border-ink-300 bg-white px-2 py-0.5 text-xs text-ink-700 font-mono" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium">
            <option value="todos">Status: Todos</option>
            <option value="Pendente de aprovação">Pendente de aprovação</option>
            <option value="Aprovada">Aprovada</option>
            <option value="Recusada">Recusada</option>
          </select>
          {(typeFilter !== 'todos' || statusFilter !== 'todos' || startDate || endDate || search) && (
            <button type="button" onClick={resetFilters} className="text-xs text-iane-600 hover:text-iane-800 font-medium ml-2">Limpar filtros</button>
          )}
          <div className="ml-auto text-[11px] text-ink-500 tabular-nums">Exibindo <strong>{visibleRequests.length}</strong> de <strong>{requests.length}</strong> solicitações</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-ink-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-ink-50 border-b border-ink-200 text-ink-600 uppercase font-semibold tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Data da solicitação</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Solicitante</th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Detalhes principais</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visibleRequests.map((request) => {
                const details = getRequestDetails(request);
                const collaborator = request.type === 'Entrega'
                  ? request.data.employeeName
                  : request.type === 'Transferência'
                    ? `${request.data.originCollaboratorName || ''} → ${request.data.destinationCollaboratorName || ''}`
                    : request.data.collaboratorName || '—';
                return (
                  <tr key={request.id} onClick={() => setSelectedRequest(request)} className="hover:bg-ink-50/80 transition-colors cursor-pointer">
                    <td className="py-3 px-4 whitespace-nowrap"><span className="font-mono text-ink-800">{formatDateTime(request.createdAt)}</span></td>
                    <td className="py-3 px-4"><span className="inline-flex items-center gap-1.5 font-semibold text-ink-900"><ClipboardList className="h-3.5 w-3.5 text-iane-600" />{request.type}</span></td>
                    <td className="py-3 px-4">{request.requesterName}</td>
                    <td className="py-3 px-4">{collaborator || '—'}</td>
                    <td className="py-3 px-4 max-w-md"><div className="space-y-0.5">{details.slice(1).filter(Boolean).map((detail, index) => <p key={index} className="text-[11px] text-ink-600 truncate">{detail}</p>)}</div></td>
                    <td className="py-3 px-4"><StatusBadge status={request.status || 'Pendente de aprovação'} type="request" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleRequests.length === 0 && (
            <div className="p-10 text-center text-ink-500">
              <ClipboardList className="w-10 h-10 text-ink-300 mx-auto mb-2" />
              <p className="font-semibold text-ink-700">Nenhuma solicitação encontrada</p>
            </div>
          )}
        </div>
      </div>

      {activeFlow && (
        <RequestModal
          key={activeFlow}
          flow={activeFlow}
          onClose={() => setActiveFlow(null)}
          onCreated={handleCreated}
        />
      )}
      {selectedRequest && <RequestDetailsModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />}
    </div>
  );
};

export const RequestDetailsModal: React.FC<{ request: RequestRecord; onClose: () => void }> = ({ request, onClose }) => {
  const labels: Record<string, string> = {
    employeeName: 'Funcionário', cpf: 'CPF', position: 'Cargo', isNewLine: 'É uma linha nova?',
    lineNumber: 'Linha', lineCarrier: 'Operadora', collaboratorName: 'Colaborador',
    department: 'Departamento', sector: 'Setor', plannedReturnDate: 'Data prevista da devolução',
    deliveryDate: 'Data de entrega', originCollaboratorName: 'Colaborador de origem',
    destinationCollaboratorName: 'Colaborador de destino', deviceTag: 'Aparelho', deviceName: 'Modelo',
    oldDeviceTag: 'Aparelho antigo', oldDeviceName: 'Modelo antigo', newDeviceTag: 'Aparelho novo',
    newDeviceName: 'Modelo novo', reason: 'Motivo', observations: 'Observações',
  };
  const displayValue = (value: any): string => {
    if (Array.isArray(value)) return value.map((item) => typeof item === 'object'
      ? [item.phoneNumber, item.assetTag, item.brand, item.model].filter(Boolean).join(' · ')
      : String(item)).join(', ') || 'Nenhum';
    if (value && typeof value === 'object') return JSON.stringify(value);
    return String(value ?? '—');
  };
  const details = Object.entries(request.data || {}).filter(([key, value]) => key !== 'estimatedDeliveryDate' && value !== undefined && value !== '');
  return (
    <Modal isOpen onClose={onClose} title={`Solicitação de ${request.type}`} subtitle={formatDateTime(request.createdAt)} maxWidth="2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-ink-50 p-3 text-xs">
          <div><span className="block text-[11px] text-ink-500">Solicitante</span><strong>{request.requesterName}</strong></div>
          <div><span className="block text-[11px] text-ink-500">Status</span><StatusBadge status={request.status || 'Pendente de aprovação'} type="request" /></div>
          {request.decidedByName && <div><span className="block text-[11px] text-ink-500">Decidida por</span><strong>{request.decidedByName}</strong></div>}
          {request.decidedAt && <div><span className="block text-[11px] text-ink-500">Data da decisão</span><strong>{formatDateTime(request.decidedAt)}</strong></div>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {details.map(([key, value]) => (
            <div key={key} className="rounded-lg border border-ink-200 p-3 text-xs">
              <span className="mb-1 block text-[11px] text-ink-500">{labels[key] || key.replace(/([A-Z])/g, ' $1')}</span>
              <span className="font-medium text-ink-800">{key === 'deliveryDate' || key === 'plannedReturnDate' ? formatDate(String(value)) : displayValue(value)}</span>
            </div>
          ))}
        </div>
        {request.status === 'Recusada' && request.rejectionReason && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <span className="mb-1 block font-semibold">Motivo da recusa</span>{request.rejectionReason}
          </div>
        )}
        {!!request.movementIds?.length && (
          <div className="rounded-lg border border-iane-200 bg-iane-50 p-3 text-xs text-iane-800">
            Movimentação(ões) vinculada(s): {request.movementIds.join(', ')}
          </div>
        )}
        <div className="flex justify-end"><button type="button" onClick={onClose} className="px-4 py-1.5 text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-lg">Fechar</button></div>
      </div>
    </Modal>
  );
};

interface RequestModalProps {
  flow: RequestFlow;
  onClose: () => void;
  onCreated: (request: RequestRecord) => void;
}

const RequestModal: React.FC<RequestModalProps> = ({ flow, onClose, onCreated }) => {
  const [form, setForm] = useState<Record<string, any>>({
    condition: 'Excelente',
    oldCondition: 'Bom',
    newCondition: 'Novo',
    destinationStatus: 'Disponível',
    oldDestinationStatus: 'Aguardando avaliação',
    lineHandling: 'transferir_linha_junto',
    returnLineHandling: 'retornar_ao_estoque',
    lineOption: 'manter_linha_atual_no_novo',
    isNewLine: '',
    accessories: ['Carregador Original', 'Cabo USB-C / Lightning'],
    oldAccessories: ['Carregador Original', 'Cabo USB-C / Lightning'],
    newAccessories: ['Carregador Original', 'Cabo USB-C / Lightning', 'Capa Protetora Anti-Impacto'],
  });
  const [collaborators] = useState<Collaborator[]>(dataService.getCollaborators());
  const [lines] = useState<PhoneLine[]>(dataService.getLines());
  const [devices] = useState<Device[]>(dataService.getDevices());
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = (key: string, value: any) => setForm((previous) => ({ ...previous, [key]: value }));
  const activeCollaborators = collaborators.filter((collaborator) => collaborator.status === 'Ativo');
  const selectedCollaborator = collaborators.find((collaborator) => collaborator.id === form.collaboratorId);
  const returnLines = selectedCollaborator
    ? lines.filter((line) => line.currentCollaboratorId === selectedCollaborator.id)
    : [];
  const returnDevices = selectedCollaborator
    ? devices.filter((device) => device.currentCollaboratorId === selectedCollaborator.id)
    : [];

  const collaboratorOptions = collaborators.map((collaborator) => ({
    id: collaborator.id,
    label: `${collaborator.fullName} · ${collaborator.registrationNumber || 'Sem matrícula'}`,
  }));
  const lineOptions = lines.map((line) => {
    const dddValue = extractLineDdd(line.phoneNumber);
    const ddd = dddValue ? ` · DDD ${dddValue}` : '';
    return { id: line.id, label: `${formatPhone(line.phoneNumber)} · ${line.carrier || 'Sem operadora'}${ddd}` };
  });
  const deviceOptions = (items: Device[]) => items.map((device) => ({
    id: device.id,
    label: `${device.assetTag} · ${device.brand} ${device.model}${device.imei1 ? ` · IMEI ${device.imei1}` : ''}`,
  }));

  const toggleAccessory = (key: string, accessory: string) => {
    const selected: string[] = form[key] || [];
    setValue(key, selected.includes(accessory)
      ? selected.filter((item) => item !== accessory)
      : [...selected, accessory]);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    if (isSubmitting) return;

    if (flow === 'entrega') {
      if (!String(form.employeeName || '').trim() || !String(form.position || '').trim()) {
        setErrorMessage('Informe o nome do funcionário e o cargo.');
        return;
      }
      if (String(form.cpf || '').replace(/\D/g, '').length !== 11) {
        setErrorMessage('Informe um CPF com 11 dígitos.');
        return;
      }
      if (!['Sim', 'Não'].includes(form.isNewLine)) {
        setErrorMessage('Informe se é uma linha nova.');
        return;
      }
      if (form.isNewLine === 'Não' && !form.lineId) {
        setErrorMessage('Selecione a linha cadastrada.');
        return;
      }
    }
    if (flow === 'devolucao' && !form.collaboratorId) {
      setErrorMessage('Selecione o colaborador cadastrado.');
      return;
    }
    if (flow === 'transferencia') {
      if (!form.originCollaboratorId || !form.deviceId || !form.destinationCollaboratorId) {
        setErrorMessage('Selecione o colaborador de origem, o aparelho e o colaborador de destino.');
        return;
      }
      if (form.originCollaboratorId === form.destinationCollaboratorId) {
        setErrorMessage('O colaborador de origem e destino devem ser diferentes.');
        return;
      }
    }
    if (flow === 'troca') {
      if (!form.collaboratorId || !form.oldDeviceId || !form.newDeviceId) {
        setErrorMessage('Selecione o colaborador, o aparelho antigo e o novo aparelho.');
        return;
      }
      if (form.oldDeviceId === form.newDeviceId) {
        setErrorMessage('O novo aparelho deve ser diferente do aparelho antigo.');
        return;
      }
    }

    let data: Record<string, any>;
    if (flow === 'entrega') {
      const selectedLine = lines.find((line) => line.id === form.lineId);
      data = {
        employeeName: String(form.employeeName).trim(),
        cpf: String(form.cpf).replace(/\D/g, ''),
        position: String(form.position).trim(),
        deliveryDate: form.deliveryDate || '',
        isNewLine: form.isNewLine,
        ...(form.isNewLine === 'Não' ? {
          lineId: selectedLine?.id,
          lineNumber: selectedLine?.phoneNumber,
          lineCarrier: selectedLine?.carrier,
        } : {}),
      };
    } else if (flow === 'devolucao') {
      data = {
        collaboratorId: selectedCollaborator?.id,
        collaboratorName: selectedCollaborator?.fullName,
        lines: returnLines.map((line) => ({ id: line.id, phoneNumber: line.phoneNumber, carrier: line.carrier })),
        devices: returnDevices.map((device) => ({ id: device.id, assetTag: device.assetTag, brand: device.brand, model: device.model, imei1: device.imei1 })),
        department: selectedCollaborator?.department || '',
        position: selectedCollaborator?.position || '',
        sector: selectedCollaborator?.sector || '',
        plannedReturnDate: form.plannedReturnDate || '',
      };
    } else if (flow === 'transferencia') {
      const origin = collaborators.find((item) => item.id === form.originCollaboratorId);
      const destination = collaborators.find((item) => item.id === form.destinationCollaboratorId);
      const device = devices.find((item) => item.id === form.deviceId);
      data = {
        originCollaboratorId: origin?.id,
        originCollaboratorName: origin?.fullName,
        destinationCollaboratorId: destination?.id,
        destinationCollaboratorName: destination?.fullName,
        deviceId: device?.id,
        deviceTag: device?.assetTag,
        deviceName: device ? `${device.brand} ${device.model}`.trim() : '',
        condition: form.condition,
        destinationStatusAfterReturn: form.destinationStatus,
        lineHandling: form.lineHandling,
        accessories: form.accessories || [],
        reason: String(form.reason || '').trim(),
        observations: String(form.observations || '').trim(),
      };
    } else {
      const collaborator = collaborators.find((item) => item.id === form.collaboratorId);
      const oldDevice = devices.find((item) => item.id === form.oldDeviceId);
      const newDevice = devices.find((item) => item.id === form.newDeviceId);
      const customLine = lines.find((line) => line.id === form.customLineId);
      data = {
        collaboratorId: collaborator?.id,
        collaboratorName: collaborator?.fullName,
        oldDeviceId: oldDevice?.id,
        oldDeviceTag: oldDevice?.assetTag,
        oldDeviceName: oldDevice ? `${oldDevice.brand} ${oldDevice.model}`.trim() : '',
        oldCondition: form.oldCondition,
        oldDestinationStatus: form.oldDestinationStatus,
        oldAccessories: form.oldAccessories || [],
        newDeviceId: newDevice?.id,
        newDeviceTag: newDevice?.assetTag,
        newDeviceName: newDevice ? `${newDevice.brand} ${newDevice.model}`.trim() : '',
        newCondition: form.newCondition,
        newAccessories: form.newAccessories || [],
        lineOption: form.lineOption,
        customLineId: customLine?.id,
        customLineNumber: customLine?.phoneNumber,
        reason: String(form.reason || '').trim(),
        observations: String(form.observations || '').trim(),
      };
    }

    const type = FLOW_OPTIONS.find((option) => option.flow === flow)!.label;
    setIsSubmitting(true);
    try {
      const result = await dataService.createRequest(type, data);
      if (!result.success || !result.request) {
        setErrorMessage(result.message);
        return;
      }
      onCreated(result.request);
    } catch {
      setErrorMessage('Não foi possível registrar a solicitação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = FLOW_OPTIONS.find((option) => option.flow === flow)?.label || 'Solicitação';
  const titleIcon = flow === 'entrega' ? <ArrowUpRight className="h-4 w-4" />
    : flow === 'devolucao' ? <ArrowDownLeft className="h-4 w-4" />
      : flow === 'transferencia' ? <ArrowLeftRight className="h-4 w-4" />
        : <Smartphone className="h-4 w-4" />;

  return (
    <Modal isOpen onClose={onClose} title={`Solicitação de ${title}`} subtitle="O envio registra o pedido e não executa a movimentação." maxWidth="2xl">
      <form onSubmit={onSubmit} className="space-y-4">
        {errorMessage && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /><span>{errorMessage}</span>
          </div>
        )}

        {(flow === 'entrega' || flow === 'devolucao') && (
          <div className="flex items-center gap-2 rounded-lg border border-iane-200 bg-iane-50/60 p-3 text-xs text-iane-800">
            {flow === 'entrega' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
            <span>{flow === 'entrega' ? 'Dados do funcionário que receberá o ativo' : 'Informações do colaborador selecionado'}</span>
          </div>
        )}

        {flow === 'entrega' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nome do funcionário *">
                <input required value={form.employeeName || ''} onChange={(event) => setValue('employeeName', event.target.value)} className={inputClass} />
              </Field>
              <Field label="CPF *">
                <input
                  required
                  inputMode="numeric"
                  maxLength={14}
                  value={form.cpf || ''}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '').slice(0, 11);
                    const masked = digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
                    setValue('cpf', masked);
                  }}
                  placeholder="000.000.000-00"
                  className={inputClass}
                />
              </Field>
              <Field label="Cargo *">
                <input required value={form.position || ''} onChange={(event) => setValue('position', event.target.value)} className={inputClass} />
              </Field>
              <Field label="É uma linha nova? *">
                <select required value={form.isNewLine} onChange={(event) => { setValue('isNewLine', event.target.value); setValue('lineId', ''); }} className={selectClass}>
                  <option value="">-- Selecione --</option><option value="Sim">Sim</option><option value="Não">Não</option>
                </select>
              </Field>
              {form.isNewLine === 'Não' && (
                <Field label="Linha cadastrada *" className="sm:col-span-2">
                  <SearchableSelect value={form.lineId || ''} options={lineOptions} placeholder="Pesquisar número, operadora ou DDD..." onChange={(value) => setValue('lineId', value)} />
                </Field>
              )}
              <Field
                label={(
                  <span className="inline-flex items-center gap-1">
                    Data de entrega
                    <span title="Data em que o aparelho será entregue ao colaborador." aria-label="Data em que o aparelho será entregue ao colaborador.">
                      <Info className="h-3.5 w-3.5 text-iane-600" aria-hidden="true" />
                    </span>
                  </span>
                )}
              >
                <input type="date" value={form.deliveryDate || ''} onChange={(event) => setValue('deliveryDate', event.target.value)} className={inputClass} />
              </Field>
            </div>
          </>
        )}

        {flow === 'devolucao' && (
          <>
            <Field label="Colaborador cadastrado *">
              <SearchableSelect value={form.collaboratorId || ''} options={collaboratorOptions} placeholder="Pesquisar colaborador ou matrícula..." onChange={(value) => setValue('collaboratorId', value)} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReadOnlyField label="Nome do colaborador" value={selectedCollaborator?.fullName || 'Nenhum'} />
              <ReadOnlyField label="Linha(s) vinculada(s)" value={returnLines.map((line) => `${line.phoneNumber}${line.carrier ? ` (${line.carrier})` : ''}`).join(', ') || 'Nenhuma'} />
              <ReadOnlyField label="Aparelho(s) vinculado(s)" value={returnDevices.map((device) => `${device.assetTag} · ${device.brand} ${device.model}`.trim()).join(', ') || 'Nenhum'} />
              <ReadOnlyField label="Departamento" value={selectedCollaborator?.department || 'Nenhum'} />
              <ReadOnlyField label="Cargo" value={selectedCollaborator?.position || 'Nenhum'} />
              <ReadOnlyField label="Setor" value={selectedCollaborator?.sector || 'Nenhum'} />
            </div>
            <Field label="Data prevista da devolução">
              <input type="date" value={form.plannedReturnDate || ''} onChange={(event) => setValue('plannedReturnDate', event.target.value)} className={inputClass} />
            </Field>
          </>
        )}

        {flow === 'transferencia' && (
          <>
            <FormSection icon={<UserRound className="h-4 w-4 text-iane-600" />} title="Origem: Colaborador A (Atual)">
              <Field label="Colaborador de Origem *">
                <SearchableSelect value={form.originCollaboratorId || ''} options={activeCollaborators.map((c) => ({ id: c.id, label: `${c.fullName} · ${c.registrationNumber || 'Sem matrícula'}` }))} placeholder="Pesquisar colaborador..." onChange={(value) => { setValue('originCollaboratorId', value); setValue('deviceId', ''); }} />
              </Field>
              <Field label="Aparelho em uso pelo Colaborador A *">
                <SearchableSelect value={form.deviceId || ''} options={deviceOptions(devices.filter((device) => device.status === 'Em uso' && device.currentCollaboratorId === form.originCollaboratorId))} placeholder="Pesquisar aparelho..." onChange={(value) => setValue('deviceId', value)} />
              </Field>
            </FormSection>
            <FormSection icon={<UserRound className="h-4 w-4 text-iane-600" />} title="Destino: Colaborador B (Novo Responsável)">
              <Field label="Colaborador de Destino *">
                <SearchableSelect value={form.destinationCollaboratorId || ''} options={activeCollaborators.filter((c) => c.id !== form.originCollaboratorId).map((c) => ({ id: c.id, label: `${c.fullName} · ${c.registrationNumber || 'Sem matrícula'} · ${c.department || 'Sem depto'}` }))} placeholder="Pesquisar colaborador..." onChange={(value) => setValue('destinationCollaboratorId', value)} />
              </Field>
            </FormSection>
            <FormSection icon={<Package className="h-4 w-4 text-iane-600" />} title="Etapa Intermediária: Estoque do Gestor">
              <Field label="Condição do aparelho">
                <select value={form.condition} onChange={(event) => setValue('condition', event.target.value)} className={selectClass}><ConditionOptions /></select>
              </Field>
              <Field label="Status do aparelho ao entrar no Estoque">
                <select value={form.destinationStatus} onChange={(event) => setValue('destinationStatus', event.target.value)} className={selectClass}>
                  <option value="Disponível">Disponível para nova entrega</option><option value="Aguardando avaliação">Aguardando avaliação / Vistoria</option><option value="Em manutenção">Em manutenção (Assistência técnica)</option>
                </select>
              </Field>
              <Field label="Tratamento da Linha Telefônica">
                <select value={form.lineHandling} onChange={(event) => setValue('lineHandling', event.target.value)} className={selectClass}>
                  <option value="transferir_linha_junto">Transferir a linha junto com o aparelho</option><option value="manter_linha_com_origem">Manter a linha com o Colaborador A</option><option value="retornar_linha_ao_estoque">Retornar a linha ao estoque (Disponível)</option>
                </select>
              </Field>
            </FormSection>
            <AccessoryChoices selected={form.accessories || []} onToggle={(item) => toggleAccessory('accessories', item)} label="Acessórios inclusos" />
            <Field label="Motivo da transferência"><textarea rows={2} value={form.reason || ''} onChange={(event) => setValue('reason', event.target.value)} className={inputClass} /></Field>
            <Field label="Observações Gerais (opcional)"><textarea rows={2} value={form.observations || ''} onChange={(event) => setValue('observations', event.target.value)} className={inputClass} /></Field>
          </>
        )}

        {flow === 'troca' && (
          <>
            <FormSection icon={<UserRound className="h-4 w-4 text-iane-600" />} title="Colaborador que fará a troca">
              <Field label="Colaborador *">
                <SearchableSelect value={form.collaboratorId || ''} options={activeCollaborators.map((c) => ({ id: c.id, label: `${c.fullName} · ${c.registrationNumber || 'Sem matrícula'}` }))} placeholder="Pesquisar colaborador..." onChange={(value) => { setValue('collaboratorId', value); setValue('oldDeviceId', ''); }} />
              </Field>
            </FormSection>
            <FormSection tone="sun" icon={<Smartphone className="h-4 w-4 text-gold-700" />} title="Aparelho Antigo (será devolvido ao Estoque)">
              <Field label="Aparelho Antigo *">
                <SearchableSelect value={form.oldDeviceId || ''} options={deviceOptions(devices.filter((device) => device.status === 'Em uso' && device.currentCollaboratorId === form.collaboratorId))} placeholder="Pesquisar aparelho..." onChange={(value) => setValue('oldDeviceId', value)} />
              </Field>
              <Field label="Condição do antigo"><select value={form.oldCondition} onChange={(event) => setValue('oldCondition', event.target.value)} className={selectClass}><ConditionOptions /></select></Field>
              <Field label="Destino do Aparelho Antigo no Estoque">
                <select value={form.oldDestinationStatus} onChange={(event) => setValue('oldDestinationStatus', event.target.value)} className={selectClass}>
                  <option value="Aguardando avaliação">Aguardando avaliação / Vistoria</option><option value="Em manutenção">Em manutenção (Assistência técnica)</option><option value="Disponível">Disponível em estoque</option><option value="Aguardando baixa patrimonial">Aguardando baixa patrimonial</option>
                </select>
              </Field>
              <AccessoryChoices selected={form.oldAccessories || []} onToggle={(item) => toggleAccessory('oldAccessories', item)} label="Acessórios do aparelho antigo" />
            </FormSection>
            <FormSection tone="green" icon={<Package className="h-4 w-4 text-emerald-700" />} title="Novo Aparelho (será entregue do Estoque)">
              <Field label="Novo Aparelho *">
                <SearchableSelect value={form.newDeviceId || ''} options={deviceOptions(devices.filter((device) => device.status === 'Disponível' && device.id !== form.oldDeviceId))} placeholder="Pesquisar aparelho disponível..." onChange={(value) => setValue('newDeviceId', value)} />
              </Field>
              <Field label="Condição do novo"><select value={form.newCondition} onChange={(event) => setValue('newCondition', event.target.value)} className={selectClass}><ConditionOptions /></select></Field>
              <Field label="Linha Telefônica no Novo Aparelho">
                <select value={form.lineOption} onChange={(event) => setValue('lineOption', event.target.value)} className={selectClass}>
                  <option value="manter_linha_atual_no_novo">Manter linha telefônica atual do colaborador no novo aparelho</option><option value="selecionar_outra_linha">Selecionar outra linha do estoque</option><option value="sem_linha">Novo aparelho sem linha associada</option>
                </select>
              </Field>
              {form.lineOption === 'selecionar_outra_linha' && (
                <Field label="Outra Linha do Estoque">
                  <SearchableSelect value={form.customLineId || ''} options={lineOptions.filter((line) => lines.some((item) => item.id === line.id && item.status === 'Disponível'))} placeholder="Pesquisar linha disponível..." onChange={(value) => setValue('customLineId', value)} />
                </Field>
              )}
              <AccessoryChoices selected={form.newAccessories || []} onToggle={(item) => toggleAccessory('newAccessories', item)} label="Acessórios do novo aparelho" />
            </FormSection>
            <Field label="Motivo da troca"><textarea rows={2} value={form.reason || ''} onChange={(event) => setValue('reason', event.target.value)} className={inputClass} /></Field>
            <Field label="Observações Gerais (opcional)"><textarea rows={2} value={form.observations || ''} onChange={(event) => setValue('observations', event.target.value)} className={inputClass} /></Field>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-ink-100 pt-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-lg">Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 shadow-xs disabled:opacity-60">
            {titleIcon}{isSubmitting ? 'Registrando...' : 'Registrar solicitação'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const Field: React.FC<{ label: React.ReactNode; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`space-y-1 ${className}`}>
    <label className="block text-xs font-medium text-ink-600">{label}</label>
    {children}
  </div>
);

const ReadOnlyField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Field label={label}>
    <input type="text" value={value} disabled className={disabledClass} />
  </Field>
);

const FormSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; tone?: 'iane' | 'sun' | 'green' }> = ({ title, icon, children, tone = 'iane' }) => {
  const colors = tone === 'sun' ? 'bg-sun-50/40 border-sun-300' : tone === 'green' ? 'bg-emerald-50/40 border-emerald-200' : 'bg-iane-50/40 border-iane-200';
  return (
    <section className={`rounded-lg border p-3 ${colors}`}>
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-ink-800">{icon}{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
};

const ConditionOptions: React.FC = () => <>
  <option value="Novo">Novo</option><option value="Excelente">Excelente</option><option value="Bom">Bom</option><option value="Regular">Regular</option><option value="Danificado">Danificado</option>
</>;

const AccessoryChoices: React.FC<{ selected: string[]; onToggle: (item: string) => void; label: string }> = ({ selected, onToggle, label }) => (
  <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
    <span className="mb-2 block text-xs font-semibold text-ink-700">{label}</span>
    <div className="flex flex-wrap gap-x-3 gap-y-2">
      {ACCESSORIES.map((item) => (
        <label key={item} className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} className="rounded border-ink-300 text-iane-600 focus:ring-iane-500" />
          <span className="text-ink-700">{item}</span>
        </label>
      ))}
    </div>
  </div>
);
