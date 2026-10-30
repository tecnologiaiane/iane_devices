import React, { useState } from 'react';
import { Device, DeviceStatus, Movement, DocumentTerm, DeviceCondition, User as AppUser } from '../types';
import { dataService, STOCK_LABEL } from '../services/dataStorage';
import { formatDate, formatCurrency, formatImei } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [stockFilter, setStockFilter] = useState<'todos' | 'em_estoque' | 'com_colaborador'>('todos');
  const [departmentFilter, setDepartmentFilter] = useState<string>('todos');
  const [brandFilter, setBrandFilter] = useState<string>('todos');

  // Detail Drawer
  const [detailDevice, setDetailDevice] = useState<Device | null>(null);
  const [detailTab, setDetailTab] = useState<'historico' | 'geral' | 'linha' | 'responsavel' | 'termos' | 'observacoes'>('historico');

  // Quick Release Modal for "Aguardando avaliação"
  const [releasingDevice, setReleasingDevice] = useState<Device | null>(null);
  const [releaseCondition, setReleaseCondition] = useState<DeviceCondition>('Excelente');
  const [releaseNotes, setReleaseNotes] = useState('Higienizado e conferido pelo Gestor de Telefonia.');

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

    if (stockFilter === 'em_estoque' && d.status === 'Em uso') return false;
    if (stockFilter === 'com_colaborador' && d.status !== 'Em uso') return false;

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
      <div className="bg-white p-4 rounded-xl border border-ink-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por IMEI, Tag, Modelo, S/N ou Colaborador..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-ink-300 bg-white placeholder-ink-400 text-ink-800 focus:outline-none focus:ring-2 focus:ring-iane-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenDeviceModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Aparelho</span>
            </button>
          </div>
        </div>

        {/* Filter chips / selects */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-100 text-xs">
          <span className="text-ink-500 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-ink-400" />
            Filtros:
          </span>

          {/* Localização / Custódia */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
          >
            <option value="todos">Custódia: Todas</option>
            <option value="em_estoque">No Estoque do Gestor</option>
            <option value="com_colaborador">Em Uso com Colaborador</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
          >
            <option value="todos">Status: Todos</option>
            <option value="Disponível">Disponível em Estoque</option>
            <option value="Em uso">Em uso (Colaborador)</option>
            <option value="Aguardando avaliação">Aguardando Avaliação (Estoque)</option>
            <option value="Em manutenção">Em Manutenção</option>
            <option value="Reservado">Reservado no Estoque</option>
            <option value="Aguardando baixa patrimonial">Aguardando Baixa</option>
            <option value="Baixado">Baixado</option>
          </select>

          {/* Departamento */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
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
            className="rounded-md border border-ink-300 bg-white px-2.5 py-1 text-ink-700 font-medium"
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
              className="text-xs text-iane-600 hover:text-iane-800 font-medium ml-2"
            >
              Resetar Filtros
            </button>
          )}

          <div className="ml-auto text-[11px] text-ink-500 tabular-nums">
            Exibindo <strong>{filteredDevices.length}</strong> de <strong>{devices.length}</strong> aparelhos
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-ink-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-ink-50 border-b border-ink-200 text-ink-600 uppercase font-semibold tracking-wider text-[11px]">
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
            <tbody className="divide-y divide-ink-100">
              {filteredDevices.map((device) => (
                <tr 
                  key={device.id} 
                  className="hover:bg-ink-50/80 transition-colors group cursor-pointer"
                  onClick={() => setDetailDevice(device)}
                >
                  {/* Tag */}
                  <td className="py-3 px-4 font-mono font-bold text-ink-900 whitespace-nowrap">
                    {device.assetTag}
                  </td>

                  {/* Brand & Model */}
                  <td className="py-3 px-4 font-medium text-ink-900">
                    <div>{device.model}</div>
                    <span className="text-[11px] text-ink-400 font-mono">S/N: {device.serialNumber}</span>
                    <span className="block text-[11px] text-ink-500">Setor: {device.sector || 'Não informado'}</span>
                  </td>

                  {/* IMEI */}
                  <td className="py-3 px-4 font-mono text-ink-600 whitespace-nowrap tabular-nums">
                    {formatImei(device.imei1)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <StatusBadge status={device.status} type="device" />
                  </td>

                  {/* Custódia / Responsável */}
                  <td className="py-3 px-4">
                    {device.status === 'Em uso' && device.currentCollaboratorName ? (
                      <div>
                        <span className="font-semibold text-ink-900">{device.currentCollaboratorName}</span>
                        {device.currentDepartment && (
                          <span className="block text-[11px] text-ink-500">{device.currentDepartment}</span>
                        )}
                      </div>
                    ) : (
                      <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px] inline-flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Estoque
                      </span>
                    )}
                  </td>

                  {/* Linha */}
                  <td className="py-3 px-4 font-mono text-ink-700 whitespace-nowrap tabular-nums">
                    {device.associatedPhoneNumber || (
                      <span className="text-ink-400 italic font-sans">Sem linha</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      title="Ver Linha do Tempo e Detalhes"
                      onClick={() => setDetailDevice(device)}
                      className="p-1.5 text-ink-500 hover:text-iane-600 hover:bg-iane-50 rounded-md transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Ação se Aguardando Avaliação: Liberar para Estoque Disponível */}
                    {device.status === 'Aguardando avaliação' && (
                      <button
                        title="Conferir e Liberar Ativo para Estoque Disponível"
                        onClick={() => setReleasingDevice(device)}
                        className="px-2 py-1 text-gold-700 bg-sun-50 hover:bg-sun-100 border border-sun-300 rounded-md transition-colors font-semibold text-xs flex items-center gap-1 inline-flex"
                      >
                        <PackageCheck className="w-3 h-3" />
                        Liberar
                      </button>
                    )}

                    <button
                      title="Editar"
                      onClick={() => onOpenDeviceModal(device)}
                      className="p-1.5 text-ink-500 hover:text-ink-800 hover:bg-ink-100 rounded-md transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {canRemoveDevice && (
                      <button
                        title="Remover"
                        onClick={() => handleDelete(device.id, device.assetTag)}
                        className="p-1.5 text-ink-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
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
            <div className="p-10 text-center text-ink-500">
              <Smartphone className="w-10 h-10 text-ink-300 mx-auto mb-2" />
              <p className="font-semibold text-ink-700">Nenhum aparelho encontrado</p>
              <p className="text-xs text-ink-500 mt-1">Ajuste os filtros de pesquisa para visualizar outros registros.</p>
            </div>
          )}
        </div>
      </div>

      {/* QUICK RELEASE MODAL (Aprovação de Estoque após avaliação) */}
      {releasingDevice && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs" onClick={() => setReleasingDevice(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl border border-ink-200 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-ink-100 pb-3">
                <PackageCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-ink-900">
                  Liberar Aparelho {releasingDevice.assetTag} para Estoque Disponível
                </h3>
              </div>
              <p className="text-xs text-ink-600 leading-relaxed">
                Após vistoria e higienização técnica pelo Gestor de Telefonia, confirme a liberação do ativo para constar como <strong>"Disponível"</strong> no estoque, habilitando novas entregas.
              </p>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Estado de Conservação Aferido
                </label>
                <select
                  value={releaseCondition}
                  onChange={(e) => setReleaseCondition(e.target.value as DeviceCondition)}
                  className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                >
                  <option value="Excelente">Excelente (Sem marcas)</option>
                  <option value="Bom">Bom (Sinais leves)</option>
                  <option value="Regular">Regular</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">
                  Anotações da Conferência
                </label>
                <input
                  type="text"
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-ink-300 bg-white px-3 py-2 text-ink-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
                <button
                  type="button"
                  onClick={() => setReleasingDevice(null)}
                  className="px-4 py-2 text-xs font-medium text-ink-700 bg-ink-100 hover:bg-ink-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRelease}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
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
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs" onClick={() => setDetailDevice(null)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div 
              className="relative bg-white rounded-xl shadow-2xl border border-ink-200 w-full max-w-3xl overflow-hidden my-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-ink-200 bg-ink-50/70 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-iane-600 text-white flex items-center justify-center shadow-xs">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-ink-900">
                        {detailDevice.assetTag} · {detailDevice.brand} {detailDevice.model}
                      </h2>
                      <StatusBadge status={detailDevice.status} type="device" />
                    </div>
                    <p className="text-xs text-ink-500">
                      Número de Série: <span className="font-mono">{detailDevice.serialNumber}</span> · Custódia: <strong>{detailDevice.status === 'Em uso' ? detailDevice.currentCollaboratorName : STOCK_LABEL}</strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setDetailDevice(null)}
                  className="text-ink-400 hover:text-ink-700 p-1.5 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-6 border-b border-ink-200 flex gap-4 overflow-x-auto text-xs font-medium">
                {[
                  { id: 'historico', label: `Linha do Tempo & Passagens por Estoque (${deviceMovements.length})` },
                  { id: 'geral', label: 'Informações Gerais' },
                  { id: 'linha', label: 'Linha Associada' },
                  { id: 'responsavel', label: 'Custódia Atual' },
                  { id: 'termos', label: `Termos (${deviceTerms.length})` },
                  { id: 'observacoes', label: 'Observações' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDetailTab(t.id as any)}
                    className={`py-3 border-b-2 whitespace-nowrap transition-colors ${
                      detailTab === t.id
                        ? 'border-iane-600 text-iane-700 font-semibold'
                        : 'border-transparent text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="p-6 max-h-[60vh] overflow-y-auto text-xs">
                {/* 1. LINHA DO TEMPO CRONOLÓGICA DAS PASSAGENS POR ESTOQUE (Conforme Seção 7) */}
                {detailTab === 'historico' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-iane-50/70 border border-iane-200 rounded-lg text-xs text-iane-800">
                      <p className="font-semibold mb-0.5">Rastreabilidade Patrimonial de Estoque:</p>
                      <p className="text-[11px] leading-relaxed">
                        Apresenta formalmente cada período de utilização por colaborador e a devolução e conferência intermediária no Estoque do Gestor de Telefonia.
                      </p>
                    </div>

                    <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-ink-200">
                      {deviceMovements.map((mov, idx) => (
                        <div key={mov.id} className="relative">
                          {/* Bullet marker */}
                          <div className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                            mov.type === 'Entrega' ? 'bg-emerald-500' :
                            mov.type === 'Devolução' ? 'bg-sun-500' :
                            mov.type === 'Liberação de Estoque' ? 'bg-indigo-500' : 'bg-iane-600'
                          }`} />

                          <div className="p-3 bg-ink-50 border border-ink-200 rounded-lg space-y-1">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-ink-900">{mov.type}</span>
                                <span className="text-[11px] font-mono text-ink-400">({mov.code})</span>
                                {mov.batchOperationId && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-mono">
                                    Lote: {mov.batchOperationId}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-ink-500 text-[11px] font-semibold">
                                {formatDate(mov.date)}
                              </span>
                            </div>

                            {/* Detalhe do Fluxo de Origem e Destino com Estoque destacado */}
                            <div className="text-[11px] text-ink-700 flex items-center gap-1.5 py-0.5 font-medium">
                              <span className="text-ink-500">De:</span>
                              <span className={`px-1.5 py-0.5 rounded ${mov.originCollaboratorName === STOCK_LABEL ? 'bg-indigo-50 text-indigo-800 font-bold' : 'text-ink-900'}`}>
                                {mov.originCollaboratorName || STOCK_LABEL}
                              </span>
                              <ArrowRight className="w-3 h-3 text-ink-400" />
                              <span className="text-ink-500">Para:</span>
                              <span className={`px-1.5 py-0.5 rounded ${mov.destinationCollaboratorName === STOCK_LABEL ? 'bg-indigo-50 text-indigo-800 font-bold' : 'text-ink-900'}`}>
                                {mov.destinationCollaboratorName || STOCK_LABEL}
                              </span>
                            </div>

                            {mov.reason && (
                              <p className="text-[11px] text-ink-600 italic">
                                "{mov.reason}"
                              </p>
                            )}

                            {mov.documentCode && (
                              <div className="pt-1">
                                <span className="text-[10px] text-iane-700 font-mono font-semibold">
                                  📄 Documento Vinculado: {mov.documentCode}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {deviceMovements.length === 0 && (
                        <p className="text-ink-500 text-center py-4">Sem movimentações registradas.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Informações Gerais */}
                {detailTab === 'geral' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-ink-50 rounded-lg border border-ink-200">
                      <div>
                        <span className="text-ink-400 text-[11px] block">Identificador do Ativo</span>
                        <span className="font-bold font-mono text-ink-900 text-sm">{detailDevice.assetTag}</span>
                      </div>
                      <div>
                        <span className="text-ink-400 text-[11px] block">Marca</span>
                        <span className="font-semibold text-ink-900">{detailDevice.brand}</span>
                      </div>
                      <div>
                        <span className="text-ink-400 text-[11px] block">Modelo</span>
                        <span className="font-semibold text-ink-900">{detailDevice.model}</span>
                      </div>
                      <div>
                        <span className="text-ink-400 text-[11px] block">Setor</span>
                        <span className="font-semibold text-ink-900">{detailDevice.sector || 'Não informado'}</span>
                      </div>
                      <div>
                        <span className="text-ink-400 text-[11px] block">IMEI</span>
                        <span className="font-mono text-ink-900">{formatImei(detailDevice.imei1)}</span>
                      </div>
                      <div>
                        <span className="text-ink-400 text-[11px] block">Número de Série</span>
                        <span className="font-mono text-ink-900">{detailDevice.serialNumber}</span>
                      </div>
                      <div>
                        <span className="text-ink-400 text-[11px] block">Estado de Conservação</span>
                        <StatusBadge status={detailDevice.condition} type="condition" />
                      </div>
                      <div>
                        <span className="text-ink-400 text-[11px] block">Valor de Aquisição</span>
                        <span className="font-mono font-semibold text-ink-900">{formatCurrency(detailDevice.purchaseValue)}</span>
                      </div>
                      <div>
                        <span className="text-ink-400 text-[11px] block">Data de Aquisição</span>
                        <span className="text-ink-900">{formatDate(detailDevice.purchaseDate)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Linha */}
                {detailTab === 'linha' && (
                  <div className="space-y-3">
                    {detailDevice.associatedLineId ? (
                      <div className="p-4 bg-iane-50/50 border border-iane-200 rounded-lg space-y-1">
                        <div className="flex items-center gap-2">
                          <PhoneCall className="w-4 h-4 text-iane-600" />
                          <span className="font-bold text-sm text-ink-900 font-mono">
                            {detailDevice.associatedPhoneNumber}
                          </span>
                        </div>
                        <p className="text-ink-600 text-xs">
                          Linha configurada neste aparelho.
                        </p>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-ink-500 border border-dashed border-ink-200 rounded-lg">
                        <p>Nenhuma linha telefônica associada a este aparelho.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Custódia Atual */}
                {detailTab === 'responsavel' && (
                  <div className="space-y-3">
                    {detailDevice.status === 'Em uso' && detailDevice.currentCollaboratorId ? (
                      <div className="p-4 bg-ink-50 border border-ink-200 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-iane-600" />
                          <span className="font-bold text-sm text-ink-900">
                            {detailDevice.currentCollaboratorName}
                          </span>
                        </div>
                        <p className="text-ink-600">
                          Departamento: <strong>{detailDevice.currentDepartment}</strong>
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-1">
                        <div className="flex items-center gap-2 font-bold text-indigo-900">
                          <Package className="w-4 h-4 text-indigo-600" />
                          <span>{STOCK_LABEL}</span>
                        </div>
                        <p className="text-indigo-800 text-xs">
                          O equipamento está sob a guarda direta do Gestor de Telefonia com status operacional <strong>"{detailDevice.status}"</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Termos */}
                {detailTab === 'termos' && (
                  <div className="space-y-3">
                    {deviceTerms.map((t) => (
                      <div key={t.id} className="p-3 bg-ink-50 border border-ink-200 rounded-lg flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-ink-900">{t.code}</span>
                            <StatusBadge status={t.status} type="term" size="sm" />
                          </div>
                          <p className="text-[11px] text-ink-600 mt-0.5">
                            {t.type} · {t.collaboratorName} ({formatDate(t.date)})
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setDetailDevice(null);
                            onViewTerm(t);
                          }}
                          className="px-3 py-1 bg-white border border-ink-300 hover:bg-ink-100 rounded text-xs font-semibold text-ink-700"
                        >
                          Visualizar
                        </button>
                      </div>
                    ))}
                    {deviceTerms.length === 0 && (
                      <p className="text-ink-500 text-center py-4">Nenhum termo vinculado a este aparelho.</p>
                    )}
                  </div>
                )}

                {/* 6. Observações */}
                {detailTab === 'observacoes' && (
                  <div className="p-4 bg-ink-50 border border-ink-200 rounded-lg">
                    <p className="text-ink-700 whitespace-pre-wrap leading-relaxed">
                      {detailDevice.notes || 'Nenhuma observação registrada para este ativo.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-ink-200 bg-ink-50 flex justify-between items-center">
                <div className="text-[11px] text-ink-500">
                  Cadastrado em {formatDate(detailDevice.createdAt)}
                </div>
                <button
                  onClick={() => setDetailDevice(null)}
                  className="px-4 py-1.5 text-xs font-medium text-ink-700 bg-white border border-ink-300 rounded-lg hover:bg-ink-100"
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
