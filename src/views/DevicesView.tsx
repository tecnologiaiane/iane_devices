import React, { useEffect, useState } from 'react';
import { Device, DeviceStatus, Movement, DocumentTerm, DeviceCondition, User as AppUser, Catalogs } from '../types';
import { dataService, STOCK_LABEL, isStockCustody, stockDisplayName } from '../services/dataStorage';
import { formatDate, formatCurrency, formatImei } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import { DeviceDetail } from '../components/device-detail';
import { QrCode } from '../components/QrCode';
import {
  Smartphone,
  Search,
  Filter,
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
} from 'lucide-react';

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

  // Detail Drawer
  const [detailDevice, setDetailDevice] = useState<Device | null>(null);
  const [detailTab, setDetailTab] = useState<'historico' | 'geral' | 'linha' | 'responsavel' | 'termos' | 'observacoes' | 'etiqueta'>('historico');

  // QR Code / Etiqueta do dispositivo
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const fetchQrUrl = async (deviceId: string) => {
    setQrLoading(true);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/qr-url`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('iane_auth_token_v2') || ''}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setQrUrl(data.data?.qrUrl || null);
      } else {
        setQrUrl(null);
      }
    } catch {
      setQrUrl(null);
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (detailDevice) {
      void fetchQrUrl(detailDevice.id);
    } else {
      setQrUrl(null);
    }
  }, [detailDevice]);

  // Quick Release Modal for "Aguardando avaliação"
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

  const handleDelete = (id: string, tag: string) => {
    if (!canRemoveDevice) {
      alert('Apenas o Super Admin pode remover aparelhos.');
      return;
    }
    if (window.confirm(`Tem certeza de que deseja excluir o cadastro do aparelho ${tag}? Esta ação não pode ser desfeita.`)) {
      const res = dataService.deleteDevice(id);
      if (!res.success) {
        alert(res.message);
      } else {
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
      setReleasingDevice(null);
      refreshData();
    } else {
      alert(res.message);
    }
  };

  const deviceMovements = detailDevice 
    ? dataService.getMovements().filter(m => m.deviceId === detailDevice.id)
    : [];

  const deviceTerms = detailDevice
    ? dataService.getTerms().filter(t => t.deviceId === detailDevice.id)
    : [];

  return (
    <div className="space-y-5">
      {/* Search and Filters Bar */}
      <div className="bg-surface p-4 rounded-xl border border-line shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por IMEI, Tag, Modelo, S/N ou Colaborador..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-line-strong bg-surface placeholder:text-muted text-text focus:outline-none focus:ring-2 focus:ring-focus/40"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenDeviceModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-on-accent bg-accent hover:bg-accent/90 shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Aparelho</span>
            </button>
          </div>
        </div>

        {/* Filter chips / selects */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line text-xs">
          <span className="text-muted font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-muted" />
            Filtros:
          </span>

          {/* Localização / Custódia */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-text font-medium"
          >
            <option value="todos">Custódia: Todas</option>
            <option value="em_estoque">No Estoque</option>
            <option value="com_colaborador">Em Uso com Colaborador</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-text font-medium"
          >
            <option value="todos">Status: Todos</option>
            {catalogs.deviceStatuses.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>

          {/* Departamento */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-text font-medium"
          >
            <option value="todos">Departamento: Todos</option>
            {uniqueDepartments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Marca */}
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-text font-medium"
          >
            <option value="todos">Marca: Todas</option>
            {uniqueBrands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {(statusFilter !== 'todos' || stockFilter !== 'todos' || departmentFilter !== 'todos' || brandFilter !== 'todos') && (
            <button
              onClick={() => {
                setStatusFilter('todos');
                setStockFilter('todos');
                setDepartmentFilter('todos');
                setBrandFilter('todos');
              }}
              className="text-xs text-accent hover:text-accent font-medium ml-2"
            >
              Resetar Filtros
            </button>
          )}

          <div className="ml-auto text-[11px] text-muted tabular-nums">
            Exibindo <strong>{filteredDevices.length}</strong> de <strong>{devices.length}</strong> aparelhos
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface rounded-xl border border-line shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ds-table">
            <thead className="bg-subtle border-b border-line text-muted uppercase font-semibold tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Tag do Ativo</th>
                <th className="py-3 px-4">Marca & Modelo</th>
                <th className="py-3 px-4">IMEI</th>
                <th className="py-3 px-4">Status Operacional</th>
                <th className="py-3 px-4">Responsável</th>
                <th className="py-3 px-4">Linha Associada</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredDevices.map((device) => (
                <tr 
                  key={device.id} 
                  className="hover:bg-subtle/80 transition-colors group cursor-pointer"
                  onClick={() => setDetailDevice(device)}
                >
                  {/* Tag */}
                  <td data-label="Tag do Ativo" className="py-3 px-4 font-mono font-bold text-text whitespace-nowrap">
                    {device.assetTag}
                  </td>

                  {/* Brand & Model */}
                  <td data-label="Marca & Modelo" className="py-3 px-4 font-medium text-text">
                    <div>{device.model}</div>
                    <span className="text-[11px] text-muted font-mono">S/N: {device.serialNumber}</span>
                    <span className="block text-[11px] text-muted">Setor: {device.sector || 'Não informado'}</span>
                  </td>

                  {/* IMEI */}
                  <td data-label="IMEI" className="py-3 px-4 font-mono text-muted whitespace-nowrap tabular-nums">
                    {formatImei(device.imei1)}
                  </td>

                  {/* Status */}
                  <td data-label="Status Operacional" className="py-3 px-4">
                    <StatusBadge status={device.status} type="device" />
                  </td>

                  {/* Custódia / Responsável */}
                  <td data-label="Responsável" className="py-3 px-4">
                    {device.status === inUseStatus && device.currentCollaboratorName ? (
                      <div>
                        <span className="font-semibold text-text">{device.currentCollaboratorName}</span>
                        {device.currentDepartment && (
                          <span className="block text-[11px] text-muted">{device.currentDepartment}</span>
                        )}
                      </div>
                    ) : (
                      <span className="font-semibold text-info-fg bg-info-bg px-2 py-0.5 rounded border border-info-bd text-[11px] inline-flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Estoque
                      </span>
                    )}
                  </td>

                  {/* Linha */}
                  <td data-label="Linha Associada" className="py-3 px-4 font-mono text-text whitespace-nowrap tabular-nums">
                    {device.associatedPhoneNumber || (
                      <span className="text-muted italic font-sans">Sem linha</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td data-label="Ações" className="py-3 px-4 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      title="Ver Linha do Tempo e Detalhes"
                      onClick={() => setDetailDevice(device)}
                      className="p-1.5 text-muted hover:text-accent hover:bg-info-bg rounded-md transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Ação se Aguardando Avaliação: Liberar para Estoque Disponível */}
                    {device.status === evaluationStatus && (
                      <button
                        title="Conferir e Liberar Ativo para Estoque Disponível"
                        onClick={() => setReleasingDevice(device)}
                        className="px-2 py-1 text-warn-fg bg-warn-bg hover:bg-warn-bg border border-warn-bd rounded-md transition-colors font-semibold text-xs flex items-center gap-1 inline-flex"
                      >
                        <PackageCheck className="w-3 h-3" />
                        Liberar
                      </button>
                    )}

                    <button
                      title="Editar"
                      onClick={() => onOpenDeviceModal(device)}
                      className="p-1.5 text-muted hover:text-text hover:bg-subtle rounded-md transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {canRemoveDevice && (
                      <button
                        title="Remover"
                        onClick={() => handleDelete(device.id, device.assetTag)}
                        className="p-1.5 text-muted hover:text-danger-fg hover:bg-danger-bg rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredDevices.length === 0 && (
            <div className="p-10 text-center text-muted">
              <Smartphone className="w-10 h-10 text-muted mx-auto mb-2" />
              <p className="font-semibold text-text">Nenhum aparelho encontrado</p>
              <p className="text-xs text-muted mt-1">Ajuste os filtros de pesquisa para visualizar outros registros.</p>
            </div>
          )}
        </div>
      </div>

      {/* QUICK RELEASE MODAL (Aprovação de Estoque após avaliação) */}
      {releasingDevice && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-xs" onClick={() => setReleasingDevice(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-surface rounded-xl shadow-xl border border-line w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-line pb-3">
                <PackageCheck className="w-5 h-5 text-ok-fg" />
                <h3 className="text-sm font-bold text-text">
                  Liberar Aparelho {releasingDevice.assetTag} para Estoque Disponível
                </h3>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Após vistoria e higienização técnica pelo Gestor de Telefonia, confirme a liberação do ativo para constar como <strong>"Disponível"</strong> no estoque, habilitando novas entregas.
              </p>

              <div>
                <label className="block text-xs font-semibold text-text mb-1">
                  Estado de Conservação Aferido
                </label>
                <select
                  value={releaseCondition}
                  onChange={(e) => setReleaseCondition(e.target.value as DeviceCondition)}
                  className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                >
                  <option value="Excelente">Excelente (Sem marcas)</option>
                  <option value="Bom">Bom (Sinais leves)</option>
                  <option value="Regular">Regular</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Anotações da Conferência
                </label>
                <input
                  type="text"
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-text"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setReleasingDevice(null)}
                  className="px-4 py-2 text-xs font-medium text-text bg-subtle hover:bg-line rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRelease}
                  className="px-4 py-2 text-xs font-semibold text-ok-bg bg-ok-fg hover:opacity-90 rounded-lg shadow-xs"
                >
                  Confirmar Liberação em Estoque
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE DETAILS DRAWER COM LINHA DO TEMPO CRONOLÓGICA DAS PASSAGENS POR ESTOQUE */}
      {detailDevice && (
        <DeviceDetail
          device={{
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
            condition: detailDevice.condition,
            department: detailDevice.currentDepartment ?? '',
            line: detailDevice.associatedPhoneNumber ?? null,
            responsible: detailDevice.currentCollaboratorName ?? null,
            observations: detailDevice.notes ?? null,
            createdAt: detailDevice.createdAt ? formatDate(detailDevice.createdAt) : null,
          }}
          history={dataService
            .getMovements()
            .filter((movement) => movement.deviceId === detailDevice.id)
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((movement) => ({
              type: movement.type,
              code: movement.code ?? null,
              date: formatDate(movement.date),
              origin: stockDisplayName(movement.originCollaboratorName),
              destination: stockDisplayName(movement.destinationCollaboratorName),
              documentCode: movement.documentCode ?? null,
              reason: movement.reason ?? null,
            }))}
          terms={dataService
            .getTerms()
            .filter(
              (term) =>
                term.deviceId === detailDevice.id || term.deviceTag === detailDevice.assetTag
            )
            .map((term) => ({
              id: term.id,
              code: term.code,
              type: term.type,
              date: formatDate(term.date),
              status: term.status,
            }))}
          qrUrl={qrUrl}
          onOpenTerm={(termId) => {
            const term = dataService.getTermById(termId);
            if (term) onViewTerm(term);
          }}
          onClose={() => setDetailDevice(null)}
        />
      )}
    </div>
  );
};
