import React, { useEffect, useRef, useState } from 'react';
import { Device, DeviceStatus, Movement, DocumentTerm, DeviceCondition, User as AppUser, Catalogs } from '../types';
import { dataService, STOCK_LABEL, isStockCustody, stockDisplayName } from '../services/dataStorage';
import { apiClient } from '../services/apiClient';
import { formatDate, formatCurrency, formatImei } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import { DeviceDetail } from '../components/device-detail';
import { QrCode } from '../components/QrCode';
import {
  Smartphone,
  Search,
  Plus,
  Eye,
  Edit2,
  Trash2,
  ArrowRight,
  PackageCheck,
  X,
  FileText,
  Clock,
  User,
  PhoneCall,
  CheckCircle2,
  Package,
  Layers,
  Link,
  Printer,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from '../components/icons';
import { Button } from '../components/button';
import { Badge } from '../components/badge';
import { FilterDropdown, FilterTrigger } from '../components/FilterDropdown';
import { DataTable, type DataTableColumn } from '../components/DataTable';

interface DevicesViewProps {
  onOpenDeviceModal: (device?: Device) => void;
  onViewTerm: (term: DocumentTerm) => void;
  currentUser?: AppUser | null;
}

export const DevicesView: React.FC<DevicesViewProps> = ({
  onOpenDeviceModal,
  onViewTerm,
  currentUser,
}) => {
  const canRemoveDevice = currentUser?.role === 'admin';
  const [devices, setDevices] = useState<Device[]>(dataService.getDevices());
  const [catalogs, setCatalogs] = useState<Catalogs>(() => dataService.getCatalogs());
  useEffect(() => { void dataService.fetchCatalogs().then(setCatalogs); }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [stockFilter, setStockFilter] = useState<'todos' | 'em_estoque' | 'com_colaborador'>('todos');
  const [departmentFilter, setDepartmentFilter] = useState<string>('todos');
  const [brandFilter, setBrandFilter] = useState<string>('todos');

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

  const [detailDevice, setDetailDevice] = useState<Device | null>(null);
  const [detailHistory, setDetailHistory] = useState<Movement[]>([]);
  const [detailTerms, setDetailTerms] = useState<DocumentTerm[]>([]);

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    if (!detailDevice) {
      setQrUrl(null);
      setQrLoading(false);
      setDetailHistory([]);
      setDetailTerms([]);
      return;
    }

    const deviceId = detailDevice.id;
    const assetTag = detailDevice.assetTag;
    let active = true;

    const sortHistory = (movements: Movement[]) =>
      movements
        .filter((movement) => movement.deviceId === deviceId || (!movement.deviceId && movement.deviceTag === assetTag))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.code.localeCompare(a.code));
    const filterTerms = (terms: DocumentTerm[]) =>
      terms.filter((term) => term.deviceId === deviceId || (!term.deviceId && term.deviceTag === assetTag));

    setDetailHistory(sortHistory(dataService.getMovements()));
    setDetailTerms(filterTerms(dataService.getTerms()));
    setQrUrl(null);
    setQrLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/qr-url`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('iane_auth_token_v2') || ''}`,
          },
        });
        if (!active) return;
        if (!res.ok) {
          setQrUrl(null);
          return;
        }
        const data = await res.json();
        if (!active) return;
        setQrUrl(data.data?.qrUrl || null);
      } catch {
        if (active) setQrUrl(null);
      } finally {
        if (active) setQrLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [detailDevice]);

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

  const [releasingDevice, setReleasingDevice] = useState<Device | null>(null);
  const [releaseCondition, setReleaseCondition] = useState<DeviceCondition>('Excelente');
  const [releaseNotes, setReleaseNotes] = useState('Higienizado e conferido pelo Gestor de Telefonia.');
  const inUseStatus = catalogs.deviceStatuses.find((item) => item.id === 'device-status-in-use')?.name || 'Em uso';
  const evaluationStatus = catalogs.deviceStatuses.find((item) => item.id === 'device-status-awaiting-evaluation')?.name || 'Aguardando avaliação';

  const refreshData = () => {
    const list = dataService.getDevices();
    setDevices(list);
    if (detailDevice) {
      const updated = list.find(d => d.id === detailDevice.id);
      setDetailDevice(updated || null);
    }
  };

  const filteredDevices = devices.filter((d) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTag = d.assetTag.toLowerCase().includes(q);
      const matchBrand = d.brand.toLowerCase().includes(q);
      const matchModel = d.model.toLowerCase().includes(q);
      const qDigits = q.replace(/\D/g, '');
      const matchImei1 = qDigits.length > 0 && (d.imei1 || '').replace(/\D/g, '').includes(qDigits);
      const matchImei2 = qDigits.length > 0 && (d.imei2 || '').replace(/\D/g, '').includes(qDigits);
      const matchSerial = (d.serialNumber || '').toLowerCase().includes(q);
      const matchCollab = d.currentCollaboratorName?.toLowerCase().includes(q) || false;
      const matchLine = d.associatedPhoneNumber?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || false;
      if (!matchTag && !matchBrand && !matchModel && !matchImei1 && !matchImei2 && !matchSerial && !matchCollab && !matchLine) {
        return false;
      }
    }

    if (statusFilter !== 'todos' && d.status !== statusFilter) return false;
    if (departmentFilter !== 'todos' && d.currentDepartment !== departmentFilter) return false;
    if (brandFilter !== 'todos' && d.brand !== brandFilter) return false;

    if (stockFilter === 'em_estoque' && d.status === inUseStatus) return false;
    if (stockFilter === 'com_colaborador' && d.status !== inUseStatus) return false;

    return true;
  });

  const uniqueDepartments = Array.from(new Set(devices.map(d => d.currentDepartment).filter(Boolean))) as string[];
  const uniqueBrands = Array.from(new Set(devices.map(d => d.brand)));

  const totalPages = Math.ceil(filteredDevices.length / pageSize) || 1;
  const paginatedDevices = filteredDevices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = (id: string, tag: string) => {
    if (!canRemoveDevice) {
      apiClient.notify({
        type: 'warning',
        title: 'Ação não permitida',
        message: 'Apenas o Super Admin pode remover aparelhos.',
      });
      return;
    }
    if (window.confirm(`Tem certeza de que deseja excluir o cadastro do aparelho ${tag}? Esta ação não pode ser desfeita.`)) {
      const res = dataService.deleteDevice(id);
      if (!res.success) {
        apiClient.notify({ type: 'error', title: 'Não foi possível remover o aparelho', message: res.message });
      } else {
        apiClient.notify({ type: 'success', title: 'Aparelho removido', message: res.message });
        refreshData();
      }
    }
  };

  const handleConfirmRelease = () => {
    if (!releasingDevice) return;
    const res = dataService.releaseDeviceToStock({
      deviceId: releasingDevice.id,
      condition: releaseCondition,
      notes: releaseNotes,
    });
    if (res.success) {
      apiClient.notify({ type: 'success', title: 'Aparelho devolvido ao estoque', message: res.message });
      setReleasingDevice(null);
      refreshData();
    } else {
      apiClient.notify({ type: 'error', title: 'Não foi possível devolver o aparelho', message: res.message });
    }
  };

  const deviceMovements = detailDevice
    ? dataService.getMovements().filter(m => m.deviceId === detailDevice.id)
    : [];

  const deviceTerms = detailDevice
    ? dataService.getTerms().filter(t => t.deviceId === detailDevice.id)
    : [];

  const columns: DataTableColumn<Device>[] = [
    {
      key: 'assetTag',
      header: 'Tag do Ativo',
      cellClassName: 'font-code font-bold text-text-primary whitespace-nowrap',
      render: (device) => device.assetTag,
    },
    {
      key: 'model',
      header: 'Marca & Modelo',
      cellClassName: 'font-medium text-text-primary',
      render: (device) => (
        <>
          <div>{device.model}</div>
          <span className="text-[11px] text-text-muted font-code">S/N: {device.serialNumber}</span>
          <span className="block text-[11px] text-text-muted">Setor: {device.sector || 'Não informado'}</span>
        </>
      ),
    },
    {
      key: 'imei',
      header: 'IMEI',
      cellClassName: 'font-code text-text-muted whitespace-nowrap tabular-nums',
      render: (device) => formatImei(device.imei1),
    },
    {
      key: 'status',
      header: 'Status Operacional',
      render: (device) => <StatusBadge status={device.status} type="device" />,
    },
    {
      key: 'collaborator',
      header: 'Responsável',
      render: (device) =>
        device.status === inUseStatus && device.currentCollaboratorName ? (
          <div>
            <span className="font-semibold text-text-primary">{device.currentCollaboratorName}</span>
            {device.currentDepartment && (
              <span className="block text-[11px] text-text-muted">{device.currentDepartment}</span>
            )}
          </div>
        ) : (
          <Badge variant="info" size="sm" showDot>
            <Package className="w-3 h-3" />
            Estoque
          </Badge>
        ),
    },
    {
      key: 'line',
      header: 'Linha Associada',
      cellClassName: 'font-code text-text-muted whitespace-nowrap tabular-nums',
      render: (device) =>
        device.associatedPhoneNumber || (
          <span className="text-text-muted italic font-body">Sem linha</span>
        ),
    },
    {
      key: 'actions',
      header: 'Ações',
      headerClassName: 'text-right',
      cellClassName: 'text-right whitespace-nowrap',
      render: (device) => (
        <div className="space-x-1" onClick={(e) => e.stopPropagation()}>
          <button
            title="Ver Linha do Tempo e Detalhes"
            onClick={() => setDetailDevice(device)}
            className="p-1.5 text-text-muted hover:text-brand-blue-action hover:bg-surface-subtle radius-base transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {device.status === evaluationStatus && (
            <button
              title="Conferir e Liberar Ativo para Estoque Disponível"
              onClick={() => setReleasingDevice(device)}
              className="p-1.5 text-status-warning-fg hover:bg-status-warning-bg radius-base transition-colors font-semibold text-xs flex items-center gap-1"
            >
              <PackageCheck className="w-3 h-3" />
              Liberar
            </button>
          )}

          <button
            title="Editar"
            onClick={() => onOpenDeviceModal(device)}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-subtle radius-base transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {canRemoveDevice && (
            <button
              title="Remover"
              onClick={() => handleDelete(device.id, device.assetTag)}
              className="p-1.5 text-text-muted hover:text-status-danger-fg hover:bg-status-danger-bg radius-base transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
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
              placeholder="Buscar por IMEI, Tag, Modelo, S/N ou Colaborador..."
              className="w-full h-9 pl-9 pr-3 text-xs field"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => onOpenDeviceModal()} className="flex items-center gap-1.5 shrink-0">
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Aparelho</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between w-full pt-2 border-t border-border-subtle text-xs">
          <div className="flex items-center gap-1 text-text-muted">
            <span className="text-[11px]">Exibindo</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{Math.min(currentPage * pageSize, filteredDevices.length)}</span>
            <span className="text-[11px]">de</span>
            <span className="text-[11px] font-semibold text-text-primary tabular-nums">{filteredDevices.length}</span>
            <span className="text-[11px]">aparelhos</span>
          </div>

          <div className="flex items-center gap-3">
            <FilterTrigger
              ref={filterMenuRef}
              isOpen={isFilterMenuOpen}
              activeCount={[
                stockFilter !== 'todos',
                statusFilter !== 'todos',
                departmentFilter !== 'todos',
                brandFilter !== 'todos',
              ].filter(Boolean).length}
              onToggle={() => setIsFilterMenuOpen((open) => !open)}
            />
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
        caption="Lista de aparelhos"
        columns={columns}
        rows={paginatedDevices}
        rowKey={(device) => device.id}
        onRowClick={setDetailDevice}
        empty={
          <div className="p-10 text-center text-text-muted">
            <Smartphone className="w-10 h-10 text-border-strong mx-auto mb-2" />
            <p className="font-semibold text-text-primary">Nenhum aparelho encontrado</p>
            <p className="text-xs text-text-muted mt-1">Ajuste os filtros de pesquisa para visualizar outros registros.</p>
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

      {releasingDevice && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-brand-navy-dark/45 backdrop-blur-sm" onClick={() => setReleasingDevice(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-surface-card radius-lg border border-border-subtle shadow-lg w-full max-w-md p-5 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border-subtle pb-3">
                <PackageCheck className="w-5 h-5 text-status-success-fg" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Liberar Aparelho {releasingDevice.assetTag} para Estoque Disponível
                </h3>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Após vistoria e higienização técnica pelo Gestor de Telefonia, confirme a liberação do ativo para constar como <strong>"Disponível"</strong> no estoque, habilitando novas entregas.
              </p>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Estado de Conservação Aferido</label>
                <select
                  value={releaseCondition}
                  onChange={(e) => setReleaseCondition(e.target.value as DeviceCondition)}
                  className="w-full h-10 text-xs field px-3 py-2"
                >
                  <option value="Excelente">Excelente (Sem marcas)</option>
                  <option value="Bom">Bom (Sinais leves)</option>
                  <option value="Regular">Regular</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Anotações da Conferência</label>
                <input
                  type="text"
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  className="w-full h-10 text-xs field px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <Button variant="ghost" size="sm" onClick={() => setReleasingDevice(null)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={handleConfirmRelease}>
                  Confirmar Liberação em Estoque
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailDevice && (
        <DeviceDetail
          device={{
            id: detailDevice.id,
            tag: detailDevice.assetTag,
            model: detailDevice.model,
            status: detailDevice.status,
            serialNumber: detailDevice.serialNumber ?? '',
            custodian:
              detailDevice.status === inUseStatus
                ? detailDevice.currentCollaboratorName ?? STOCK_LABEL
                : STOCK_LABEL,
            brand: detailDevice.brand ?? '',
            imei: detailDevice.imei1 ?? '',
            imei2: detailDevice.imei2,
            condition: detailDevice.condition,
            department: detailDevice.currentDepartment ?? '',
            sector: detailDevice.sector,
            unit: detailDevice.unit,
            line: detailDevice.associatedPhoneNumber ?? null,
            responsible: detailDevice.currentCollaboratorName ?? null,
            observations: detailDevice.notes ?? null,
            purchaseDate: detailDevice.purchaseDate,
            purchaseValue: detailDevice.purchaseValue,
          }}
          history={detailHistory}
          terms={detailTerms}
          qrUrl={qrUrl}
          qrLoading={qrLoading}
          onViewTerm={onViewTerm}
          onClose={() => setDetailDevice(null)}
        />
      )}
    </div>
  );
};
