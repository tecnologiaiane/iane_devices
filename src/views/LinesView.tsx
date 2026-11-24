import React, { useEffect, useRef, useState } from 'react';
import { PhoneLine, Carrier, LineStatus, Device, Catalogs } from '../types';
import { dataService } from '../services/dataStorage';
import { apiClient } from '../services/apiClient';
import { formatDate, formatCurrency, formatPhone, matchesPhoneSearch } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import {
  PhoneCall,
  Search,
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../components/button';
import { Badge } from '../components/badge';
import { FilterDropdown, FilterField, FilterMultiSelect, FilterTrigger } from '../components/FilterDropdown';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { DownloadMenu } from '../components/DownloadMenu';

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
  const [departmentFilter, setDepartmentFilter] = useState<string>('todos');
  const [sectorFilter, setSectorFilter] = useState<string[]>([]);
  const [associationFilter, setAssociationFilter] = useState<'todos' | 'com_aparelho' | 'sem_aparelho'>('todos');

  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLButtonElement>(null);
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isFilterMenuOpen || !filterMenuRef.current) {
      setFilterPosition(null);
      return;
    }
    const rect = filterMenuRef.current.getBoundingClientRect();
    setFilterPosition({ top: rect.bottom + 4, left: rect.left });
  }, [isFilterMenuOpen]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageSizes = [10, 25, 50, 100];

  const [detailLine, setDetailLine] = useState<PhoneLine | null>(null);

  const [associatingLine, setAssociatingLine] = useState<PhoneLine | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const refreshData = () => {
    const list = dataService.getLines();
    setLines(list);
    if (detailLine) {
      setDetailLine(list.find(l => l.id === detailLine.id) || null);
    }
  };

  /**
   * A linha não possui campo de setor no cadastro. Para filtrar, derivamos o
   * setor do colaborador vinculado à linha ou, na ausência dele, do colaborador
   * do aparelho associado. O departamento usa o campo da linha com o mesmo
   * fallback. Nada é gravado nos registros.
   */
  const organizationForLine = (line: PhoneLine) => {
    const collaborators = dataService.getCollaborators();
    let collaborator = line.currentCollaboratorId
      ? collaborators.find((item) => item.id === line.currentCollaboratorId)
      : undefined;
    if (!collaborator && line.associatedDeviceId) {
      const device = dataService.getDeviceById(line.associatedDeviceId);
      collaborator = device?.currentCollaboratorId
        ? collaborators.find((item) => item.id === device.currentCollaboratorId)
        : undefined;
    }

    return {
      department: line.department || collaborator?.department || '',
      sector: collaborator?.sector || '',
    };
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
    const organization = organizationForLine(l);
    if (departmentFilter !== 'todos' && organization.department !== departmentFilter) return false;
    if (sectorFilter.length > 0 && !sectorFilter.includes(organization.sector)) return false;

    if (associationFilter === 'com_aparelho' && !l.associatedDeviceId) return false;
    if (associationFilter === 'sem_aparelho' && l.associatedDeviceId) return false;

    return true;
  });

  const departmentOptions = Array.from(new Set([
    ...catalogs.departments.map((item) => item.name),
    ...lines.map((line) => organizationForLine(line).department).filter(Boolean),
  ]));
  const sectorOptions = Array.from(new Set([
    ...catalogs.sectors.map((item) => item.name),
    ...lines.map((line) => organizationForLine(line).sector).filter(Boolean),
  ]));

  const totalPages = Math.ceil(filteredLines.length / pageSize) || 1;
  const paginatedLines = filteredLines.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = (id: string, phone: string) => {
    if (window.confirm(`Deseja excluir a linha telefônica ${phone}?`)) {
      const res = dataService.deleteLine(id);
      if (!res.success) {
        apiClient.notify({ type: 'error', title: 'Não foi possível excluir a linha', message: res.message });
      } else {
        apiClient.notify({ type: 'success', title: 'Linha removida', message: res.message });
        refreshData();
      }
    }
  };

  const handleDisassociate = (id: string) => {
    if (window.confirm('Deseja desassociar esta linha telefônica do aparelho atual?')) {
      const res = dataService.disassociateLine(id);
      if (res.success) {
        apiClient.notify({ type: 'success', title: 'Linha desassociada', message: res.message });
        refreshData();
      } else {
        apiClient.notify({ type: 'error', title: 'Não foi possível desassociar a linha', message: res.message });
      }
    }
  };

  const handleConfirmAssociate = () => {
    if (!associatingLine || !selectedDeviceId) return;
    const res = dataService.associateLineToDevice(associatingLine.id, selectedDeviceId);
    if (res.success) {
      apiClient.notify({ type: 'success', title: 'Linha associada', message: res.message });
      setAssociatingLine(null);
      setSelectedDeviceId('');
      refreshData();
    } else {
      apiClient.notify({ type: 'error', title: 'Não foi possível associar a linha', message: res.message });
    }
  };

  const availableDevices = dataService.getDevices().filter(d => d.status !== 'Baixado');

  const columns: DataTableColumn<PhoneLine>[] = [
    {
      key: 'phone',
      header: 'Número da Linha',
      cellClassName: 'font-code font-bold text-text-primary whitespace-nowrap',
      render: (line) => formatPhone(line.phoneNumber),
    },
    {
      key: 'carrier',
      header: 'Operadora',
      cellClassName: 'font-semibold text-text-primary',
      render: (line) => line.carrier,
    },
    {
      key: 'plan',
      header: 'Plano Contratado',
      cellClassName: 'text-text-muted max-w-[200px] truncate',
      render: (line) => line.planName || 'Não informado',
    },
    {
      key: 'cost',
      header: 'Custo Mensal',
      cellClassName: 'font-code text-text-muted tabular-nums',
      render: (line) => formatCurrency(line.monthlyCost),
    },
    {
      key: 'status',
      header: 'Status da Linha',
      render: (line) => <StatusBadge status={line.status} type="line" />,
    },
    {
      key: 'device',
      header: 'Aparelho Associado',
      render: (line) =>
        line.associatedDeviceTag ? (
          <Badge variant="info" size="sm" showDot className="text-[11px]">
            <PhoneCall className="w-2.5 h-2.5" />
            {line.associatedDeviceTag}
          </Badge>
        ) : (
          <span className="text-text-muted italic font-body">Nenhum</span>
        ),
    },
    {
      key: 'collaborator',
      header: 'Colaborador / Setor',
      render: (line) =>
        line.currentCollaboratorName ? (
          <div>
            <span className="font-medium text-text-primary">{line.currentCollaboratorName}</span>
            {line.department && (
              <span className="block text-[11px] text-text-muted">{line.department}</span>
            )}
          </div>
        ) : (
          <span className="text-text-muted italic font-body">Disponível em Estoque</span>
        ),
    },
    {
      key: 'actions',
      header: 'Ações',
      headerClassName: 'text-right',
      cellClassName: 'text-right whitespace-nowrap',
      render: (line) => (
        <div className="space-x-1" onClick={(e) => e.stopPropagation()}>
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
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por número, operadora, plano, colaborador..."
              className="w-full h-9 pl-9 pr-3 text-xs field"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => onOpenLineModal()} className="flex items-center gap-1.5 shrink-0">
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Linha</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between w-full pt-2 border-t border-border-subtle text-xs">
          <div className="flex items-center gap-1 text-text-muted">
            <span className="text-[11px]">Exibindo</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{Math.min(currentPage * pageSize, filteredLines.length)}</span>
            <span className="text-[11px]">de</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{filteredLines.length}</span>
            <span className="text-[11px]">linhas</span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <DownloadMenu fileName="linhas" data={filteredLines} columns={columns} />
            <FilterTrigger
              ref={filterMenuRef}
              isOpen={isFilterMenuOpen}
              activeCount={[
                statusFilter !== 'todos',
                carrierFilter !== 'todos',
                departmentFilter !== 'todos',
                sectorFilter.length > 0,
                associationFilter !== 'todos',
              ].filter(Boolean).length}
              onToggle={() => setIsFilterMenuOpen((open) => !open)}
            />
            <FilterDropdown
              isOpen={isFilterMenuOpen}
              position={filterPosition}
              activeCount={[
                statusFilter !== 'todos',
                carrierFilter !== 'todos',
                departmentFilter !== 'todos',
                sectorFilter.length > 0,
                associationFilter !== 'todos',
              ].filter(Boolean).length}
              onClose={() => setIsFilterMenuOpen(false)}
              onClear={() => {
                setStatusFilter('todos');
                setCarrierFilter('todos');
                setDepartmentFilter('todos');
                setSectorFilter([]);
                setAssociationFilter('todos');
              }}
            >
              <FilterField
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={catalogs.lineStatuses.map((item) => ({ label: item.name, value: item.name }))}
              />
              <FilterField
                label="Operadora"
                value={carrierFilter}
                onChange={setCarrierFilter}
                options={[
                  { label: 'Vivo', value: 'Vivo' },
                  { label: 'Claro', value: 'Claro' },
                  { label: 'TIM', value: 'TIM' },
                ]}
              />
              <FilterField
                label="Departamento"
                value={departmentFilter}
                onChange={setDepartmentFilter}
                options={departmentOptions.map((department) => ({ label: department, value: department }))}
              />
              <FilterMultiSelect
                label="Setor"
                values={sectorFilter}
                onChange={setSectorFilter}
                options={sectorOptions.map((sector) => ({ label: sector, value: sector }))}
              />
              <FilterField
                label="Vínculo"
                value={associationFilter}
                onChange={(value) => setAssociationFilter(value as 'todos' | 'com_aparelho' | 'sem_aparelho')}
                options={[
                  { label: 'Com Aparelho Associado', value: 'com_aparelho' },
                  { label: 'Sem Aparelho (Chip Livre / BYOD)', value: 'sem_aparelho' },
                ]}
              />
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

      <DataTable
        caption="Lista de linhas telefônicas"
        columns={columns}
        rows={paginatedLines}
        rowKey={(line) => line.id}
        onRowClick={setDetailLine}
        empty={
          <div className="p-10 text-center text-text-muted">
            <PhoneCall className="w-10 h-10 text-border-strong mx-auto mb-2" />
            <p className="font-semibold text-text-primary">Nenhuma linha encontrada</p>
            <p className="text-[11px] text-text-muted mt-1">Ajuste os filtros de pesquisa para visualizar outros registros.</p>
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
                  className="w-full h-10 text-xs field px-3 py-2"
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
                <div className="text-[11px] p-3 radius-base bg-surface-subtle border border-border-subtle text-text-muted">
                  <span className="font-medium block mb-0.5">Observações:</span>
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
