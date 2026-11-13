import React, { useEffect, useState } from 'react';
import { dataService, stockDisplayName } from '../services/dataStorage';
import { formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { NavTab } from '../components/Sidebar';
import { Catalogs, User } from '../types';
import { Button } from '../components/button';
import { Badge } from '../components/badge';
import {
  Smartphone,
  PhoneCall,
  Users,
  Package,
  CheckCircle2,
  Wrench,
  Clock,
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  Building2,
  Tag,
  FileText,
  FileWarning,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  currentUser: User | null;
}

const PENDING_TERMS_STORAGE_KEY = 'iane_pending_terms_notice_count';
const DONUT_RADIUS = 54;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const TARGET_DDDS = ['83', '71', '84'];

function extractDdd(phoneNumber?: string): string | null {
  let digits = String(phoneNumber || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0055')) digits = digits.slice(4);
  else if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.replace(/^0+/, '');
  if (digits.length < 10) return null;
  return digits.slice(0, 2);
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, currentUser }) => {
  const [catalogs, setCatalogs] = useState<Catalogs>(() => dataService.getCatalogs());
  useEffect(() => { void dataService.fetchCatalogs().then(setCatalogs); }, []);
  const sectors = catalogs.sectors.map((item) => item.name);
  const deviceInUseStatus = catalogs.deviceStatuses.find((item) => item.id === 'device-status-in-use')?.name || 'Em uso';
  const deviceAvailableStatus = catalogs.deviceStatuses.find((item) => item.id === 'device-status-available')?.name || 'Disponível';
  const lineInUseStatus = catalogs.lineStatuses.find((item) => item.id === 'line-status-in-use')?.name || 'Em Uso';
  const lineAvailableStatus = catalogs.lineStatuses.find((item) => item.id === 'line-status-available')?.name || 'Disponível';
  const evaluationStatus = catalogs.deviceStatuses.find((item) => item.id === 'device-status-awaiting-evaluation')?.name || 'Aguardando avaliação';
  const maintenanceStatus = catalogs.deviceStatuses.find((item) => item.id === 'device-status-maintenance')?.name || 'Em manutenção';
  const metrics = dataService.getDashboardMetrics();
  const devices = dataService.getDevices();
  const lines = dataService.getLines();
  const movements = dataService.getMovements();
  const terms = dataService.getTerms();
  const collaborators = dataService.getCollaborators();

  const permissions = currentUser?.permissions || [];
  const isAdmin = currentUser?.role === 'admin' || permissions.includes('all');

  const pendingTerms = terms.filter((t) => t.status === 'Pendente de Assinatura');
  const signedTerms = terms.filter((t) => t.status === 'Assinado');
  const archivedTerms = terms.filter((t) => t.status === 'Arquivado');

  const [isPendingTermsModalOpen, setIsPendingTermsModalOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin || pendingTerms.length === 0) return;
    try {
      if (sessionStorage.getItem(PENDING_TERMS_STORAGE_KEY) === String(pendingTerms.length)) return;
    } catch {
      // sessionStorage indisponível: segue com o aviso nesta renderização
    }
    setIsPendingTermsModalOpen(true);
  }, [isAdmin, pendingTerms.length]);

  const closePendingTermsModal = () => {
    setIsPendingTermsModalOpen(false);
    try {
      sessionStorage.setItem(PENDING_TERMS_STORAGE_KEY, String(pendingTerms.length));
    } catch {
      // sessionStorage indisponível: o aviso pode reaparecer na próxima visita
    }
  };

  const statusSegments = [
    { label: 'Em uso', count: metrics.inUseDevices, color: 'var(--color-brand-blue-action)' },
    { label: 'Disponíveis', count: metrics.stockAvailable, color: 'var(--color-status-success-fg)' },
    { label: 'Aguardando avaliação', count: metrics.stockAwaitingEvaluation, color: 'var(--color-status-warning-fg)' },
    { label: 'Em manutenção', count: metrics.stockMaintenance, color: 'var(--color-status-danger-fg)' },
    { label: 'Reservados', count: metrics.stockReserved, color: 'var(--color-text-muted)' },
    { label: 'Aguardando baixa', count: metrics.stockAwaitingDisposal, color: 'var(--color-text-muted)' },
    { label: 'Baixados', count: metrics.stockDisposed, color: 'var(--color-text-muted)' },
    { label: 'Extraviados', count: metrics.lostDevices, color: 'var(--color-status-danger-fg)' },
  ].filter((segment) => segment.count > 0);

  const totalSegments = statusSegments.reduce((sum, segment) => sum + segment.count, 0);

  let donutCursor = 0;
  const donutArcs = statusSegments.map((segment) => {
    const dash = totalSegments > 0 ? (segment.count / totalSegments) * DONUT_CIRCUMFERENCE : 0;
    const arc = { ...segment, dash, offset: donutCursor };
    donutCursor += dash;
    return arc;
  });

  const devicesByDepartment = Object.entries(
    devices.reduce<Record<string, number>>((acc, device) => {
      const department = device.currentDepartment?.trim() || 'Estoque de TI';
      acc[department] = (acc[department] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const devicesByBrand = Object.entries(
    devices.reduce<Record<string, number>>((acc, device) => {
      acc[device.brand] = (acc[device.brand] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const maxDepartmentCount = devicesByDepartment[0]?.[1] || 1;

  const evaluatingDevices = devices.filter((d) => d.status === evaluationStatus);
  const maintenanceDevices = devices.filter((d) => d.status === maintenanceStatus);
  const attentionDevices = [...evaluatingDevices, ...maintenanceDevices];

  const activeCollaborators = collaborators.filter((c) => c.status === 'Ativo').length;
  const signedTermsPercent = terms.length > 0 ? Math.round((signedTerms.length / terms.length) * 100) : 0;

  const dddRows = TARGET_DDDS.map((ddd) => ({
    ddd: `0${ddd}`,
    active: lines.filter((l) => extractDdd(l.phoneNumber) === ddd && (l.status === lineInUseStatus || l.status === 'Ativa')).length,
    available: lines.filter((l) => extractDdd(l.phoneNumber) === ddd && l.status === lineAvailableStatus).length,
  }));
  const linesOutsideTargetDdds = lines.filter((l) => {
    const ddd = extractDdd(l.phoneNumber);
    return !ddd || !TARGET_DDDS.includes(ddd);
  }).length;

  const inUseBySector = new Map<string, number>(sectors.map((sector) => [sector, 0]));
  let inUseWithoutSector = 0;
  devices.forEach((device) => {
    if (device.status !== deviceInUseStatus) return;
    const sector = device.sector?.trim();
    if (sector && inUseBySector.has(sector)) {
      inUseBySector.set(sector, (inUseBySector.get(sector) || 0) + 1);
    } else {
      inUseWithoutSector += 1;
    }
  });

  const percent = (value: number) =>
    metrics.totalDevices > 0 ? Math.round((value / metrics.totalDevices) * 100) : 0;

  const firstName = (currentUser?.fullName || currentUser?.username || '').split(' ')[0];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 radius-lg border border-border-subtle bg-surface-card shadow-sm border-t-4 border-t-brand-blue-action">
          <div className="flex items-center justify-between text-text-muted mb-1">
            <span className="text-xs font-medium">Aparelhos</span>
            <Smartphone className="w-4 h-4 text-brand-blue-action" />
          </div>
          <div className="text-2xl font-bold font-code tabular-nums text-text-primary">
            {metrics.totalDevices}
          </div>
          <div className="mt-1.5 text-[11px] text-text-muted">Cadastrados na frota</div>
        </div>

        <div className="p-4 radius-lg border border-border-subtle bg-surface-card shadow-sm border-t-4 border-t-brand-blue-action">
          <div className="flex items-center justify-between text-text-muted mb-1">
            <span className="text-xs font-medium">Em uso</span>
            <Users className="w-4 h-4 text-brand-blue-action" />
          </div>
          <div className="text-2xl font-bold font-code tabular-nums text-text-primary">
            {metrics.inUseDevices}
          </div>
          <div className="mt-1.5 text-[11px] text-brand-blue-action font-medium">
            {percent(metrics.inUseDevices)}% com colaboradores
          </div>
        </div>

        <div className="p-4 radius-lg border border-border-subtle bg-surface-card shadow-sm border-t-4 border-t-brand-blue-action">
          <div className="flex items-center justify-between text-text-muted mb-1">
            <span className="text-xs font-medium">No estoque</span>
            <Package className="w-4 h-4 text-brand-blue-action" />
          </div>
          <div className="text-2xl font-bold font-code tabular-nums text-text-primary">
            {metrics.stockTotal}
          </div>
          <div className="mt-1.5 text-[11px] text-text-muted">Sob custódia de TI</div>
        </div>

        <div className="p-4 radius-lg border border-status-success-border bg-status-success-bg border-t-4 border-t-status-success-fg shadow-sm">
          <div className="flex items-center justify-between text-status-success-fg mb-1">
            <span className="text-xs font-bold">Disponíveis</span>
            <CheckCircle2 className="w-4 h-4 text-status-success-fg" />
          </div>
          <div className="text-2xl font-bold font-code tabular-nums text-status-success-fg">
            {metrics.stockAvailable}
          </div>
          <div className="mt-1.5 text-[11px] text-status-success-fg font-medium">Prontos para entrega</div>
        </div>

        <div className="p-4 radius-lg border border-border-subtle bg-surface-card shadow-sm border-t-4 border-t-status-warning-fg">
          <div className="flex items-center justify-between text-text-muted mb-1">
            <span className="text-xs font-medium">Em manutenção</span>
            <Wrench className="w-4 h-4 text-status-warning-fg" />
          </div>
          <div className="text-2xl font-bold font-code tabular-nums text-text-primary">
            {metrics.stockMaintenance}
          </div>
          <div className="mt-1.5 text-[11px] text-text-muted">Em assistência técnica</div>
        </div>

        <div className="p-4 radius-lg border border-border-subtle bg-surface-card shadow-sm border-t-4 border-t-brand-blue-action">
          <div className="flex items-center justify-between text-text-muted mb-1">
            <span className="text-xs font-medium">Linhas ativas</span>
            <PhoneCall className="w-4 h-4 text-brand-blue-action" />
          </div>
          <div className="text-2xl font-bold font-code tabular-nums text-text-primary">
            {metrics.activeLines}
          </div>
          <div className="mt-1.5 text-[11px] text-text-muted">
            <span className="text-status-success-fg font-semibold tabular-nums">{metrics.availableLines}</span> livres
            {' · '}
            {metrics.totalLines} no total
          </div>
        </div>
      </div>

      {/* Gráficos e resumos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status dos aparelhos (donut) */}
        <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Status dos aparelhos</h2>
              <p className="text-[11px] text-text-muted">Como a frota está distribuída hoje</p>
            </div>
            <Smartphone className="w-4 h-4 text-text-muted" />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative w-40 h-40 shrink-0">
              <svg viewBox="0 0 140 140" className="w-40 h-40 -rotate-90" role="img" aria-label="Distribuição dos aparelhos por status">
                <circle cx="70" cy="70" r={DONUT_RADIUS} fill="none" stroke="#ECEFF6" strokeWidth="16" />
                {donutArcs.map((arc) => (
                  <circle
                    key={arc.label}
                    cx="70"
                    cy="70"
                    r={DONUT_RADIUS}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="16"
                    strokeDasharray={`${arc.dash} ${DONUT_CIRCUMFERENCE - arc.dash}`}
                    strokeDashoffset={-arc.offset}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold font-code tabular-nums text-text-primary">
                  {metrics.totalDevices}
                </span>
                <span className="text-[10px] text-text-muted uppercase tracking-wider">aparelhos</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2">
              {statusSegments.map((segment) => (
                <div key={segment.label} className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                    <span className="text-text-muted truncate">{segment.label}</span>
                  </div>
                  <span className="font-code text-text-muted tabular-nums shrink-0">
                    {segment.count} <span className="text-text-muted">({percent(segment.count)}%)</span>
                  </span>
                </div>
              ))}
              {statusSegments.length === 0 && (
                <p className="text-[11px] text-text-muted">Nenhum aparelho cadastrado ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* Resumo de linhas por DDD */}
        <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm flex flex-col">
          <div className="px-5 pt-5 pb-3 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Resumo de linhas</h2>
              <p className="text-[11px] text-text-muted">Ativas e disponíveis por DDD</p>
            </div>
            <PhoneCall className="w-4 h-4 text-text-muted" />
          </div>

          <div className="flex-1 overflow-y-auto max-h-64">
            <table className="w-full text-[11px] border-collapse">
              <thead className="text-text-muted font-semibold uppercase tracking-wider">
                <tr>
                  <th className="sticky top-0 bg-surface-subtle py-2 px-4 text-left border-y border-border-subtle">DDD</th>
                  <th className="sticky top-0 bg-surface-subtle py-2 px-4 text-center border-y border-border-subtle">Ativas</th>
                  <th className="sticky top-0 bg-surface-subtle py-2 px-4 text-center border-y border-border-subtle">Disponíveis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {dddRows.map((row, index) => (
                  <tr key={row.ddd} className={index % 2 === 1 ? 'bg-surface-subtle' : undefined}>
                    <td className="py-2.5 px-4 font-code font-semibold text-text-primary">{row.ddd}</td>
                    <td className="py-2.5 px-4 text-center font-code tabular-nums text-text-primary">{row.active}</td>
                    <td className="py-2.5 px-4 text-center font-code tabular-nums text-status-success-fg">{row.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-border-subtle text-[11px] text-text-muted">
            {linesOutsideTargetDdds} linha(s) fora dos DDDs 083, 071 e 084.
          </div>
        </div>

        {/* Termos e documentos */}
        <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-5 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Termos e documentos</h2>
              <p className="text-[11px] text-text-muted">Assinaturas e arquivos de guarda</p>
            </div>
            <FileText className="w-4 h-4 text-text-muted" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 radius-base border border-status-warning-border bg-status-warning-bg">
              <div className="text-lg font-bold font-code tabular-nums text-status-warning-fg">{pendingTerms.length}</div>
              <div className="text-[10px] font-medium text-status-warning-fg">Pendentes</div>
            </div>
            <div className="p-2.5 radius-base border border-status-success-border bg-status-success-bg">
              <div className="text-lg font-bold font-code tabular-nums text-status-success-fg">{signedTerms.length}</div>
              <div className="text-[10px] font-medium text-status-success-fg">Assinados</div>
            </div>
            <div className="p-2.5 radius-base border border-border-subtle bg-surface-subtle">
              <div className="text-lg font-bold font-code tabular-nums text-text-muted">{archivedTerms.length}</div>
              <div className="text-[10px] font-medium text-text-muted">Arquivados</div>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 flex-1">
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>Documentos assinados</span>
              <span className="font-code tabular-nums">{signedTermsPercent}%</span>
            </div>
            <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-blue-action rounded-full transition-all duration-300"
                style={{ width: `${signedTermsPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-text-muted pt-1">
              {signedTerms.length} de {terms.length} documentos concluídos.
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-border-subtle flex items-center justify-between">
            <span className="text-[11px] text-text-muted">{pendingTerms.length} aguardando assinatura</span>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('termos')} className="flex items-center gap-1">
              Abrir termos
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Departamentos, fabricantes e aparelhos por setor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Aparelhos por departamento</h2>
              <p className="text-[11px] text-text-muted">Onde a frota está alocada</p>
            </div>
            <Building2 className="w-4 h-4 text-text-muted" />
          </div>

          <div className="space-y-3">
            {devicesByDepartment.slice(0, 6).map(([department, count]) => (
              <div key={department} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <span className="font-medium text-text-muted truncate">{department}</span>
                  <span className="font-code text-text-muted tabular-nums shrink-0">{count}</span>
                </div>
                <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-navy-base rounded-full"
                    style={{ width: `${Math.round((count / maxDepartmentCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {devicesByDepartment.length === 0 && (
              <p className="text-[11px] text-text-muted">Nenhum aparelho alocado.</p>
            )}
          </div>
        </div>

        <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Aparelhos por fabricante</h2>
              <p className="text-[11px] text-text-muted">Marcas presentes na frota</p>
            </div>
            <Tag className="w-4 h-4 text-text-muted" />
          </div>

          <div className="flex flex-wrap gap-2">
            {devicesByBrand.slice(0, 10).map(([brand, count]) => (
              <span
                key={brand}
                className="text-[11px] px-2.5 py-1.5 radius-base border border-border-subtle bg-surface-subtle font-medium text-text-muted"
              >
                {brand}
                <span className="ml-1.5 font-code font-bold text-brand-blue-action tabular-nums">{count}</span>
              </span>
            ))}
            {devicesByBrand.length === 0 && (
              <p className="text-[11px] text-text-muted">Nenhum fabricante registrado.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-muted block">Colaboradores ativos</span>
              <span className="text-base font-bold font-code tabular-nums text-text-primary">{activeCollaborators}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-muted block">Sem aparelho</span>
              <span className="text-base font-bold font-code tabular-nums text-text-primary">{metrics.devicesWithoutCollaborator}</span>
            </div>
          </div>
        </div>

        <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm flex flex-col">
          <div className="px-5 pt-5 pb-3 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Aparelhos por Setor</h2>
              <p className="text-[11px] text-text-muted">Aparelhos em uso por setor do aparelho</p>
            </div>
            <Building2 className="w-4 h-4 text-text-muted" />
          </div>

          <div className="flex-1 overflow-y-auto max-h-64">
            <table className="w-full text-[11px] border-collapse">
              <thead className="text-text-muted font-semibold uppercase tracking-wider">
                <tr>
                  <th className="sticky top-0 bg-surface-subtle py-2 px-4 text-left border-y border-border-subtle">Setor</th>
                  <th className="sticky top-0 bg-surface-subtle py-2 px-4 text-center border-y border-border-subtle">Em Uso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sectors.map((sector, index) => (
                  <tr key={sector} className={index % 2 === 1 ? 'bg-surface-subtle' : undefined}>
                    <td className="py-2.5 px-4 font-medium text-text-primary">{sector}</td>
                    <td className="py-2.5 px-4 text-center font-code tabular-nums text-text-primary">
                      {inUseBySector.get(sector) || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-border-subtle text-[11px] text-text-muted">
            {inUseWithoutSector} aparelho(s) em uso sem Setor definido.
          </div>
        </div>
      </div>

      {/* Listas operacionais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-warning-fg" />
              <h2 className="text-sm font-semibold text-text-primary">Atenção necessária</h2>
            </div>
            <span className="text-[11px] text-text-muted font-medium">
              {attentionDevices.length} aparelho(s)
            </span>
          </div>

          <div className="space-y-2.5">
            {attentionDevices.slice(0, 6).map((device) => (
              <div
                key={device.id}
                className={`p-3 radius-base border flex items-start justify-between gap-3 ${
                  device.status === maintenanceStatus
                    ? 'bg-status-warning-bg/50 border-status-warning-border'
                    : 'bg-status-warning-bg/50 border-status-warning-border'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-text-primary font-code text-[11px]">{device.assetTag}</span>
                    <StatusBadge status={device.status} type="device" size="sm" />
                  </div>
                  <p className="text-[11px] text-text-muted truncate">
                    {device.model}
                    {device.notes ? ` · ${device.notes}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('dispositivos')}
                  className="text-[11px] font-semibold text-brand-blue-action hover:underline shrink-0"
                >
                  Abrir
                </button>
              </div>
            ))}

            {attentionDevices.length === 0 && (
              <div className="py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-status-success-fg mx-auto mb-2" />
                <p className="text-xs font-semibold text-text-primary">Nenhuma pendência no estoque</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Não há aparelhos aguardando avaliação ou em manutenção.
                </p>
              </div>
            )}

            {attentionDevices.length > 6 && (
              <button
                type="button"
                onClick={() => onNavigate('dispositivos')}
                className="mt-3 w-full py-2 text-[11px] font-semibold text-brand-blue-action bg-surface-subtle hover:bg-surface-card radius-base transition-colors"
              >
                Ver todos os {attentionDevices.length} aparelhos
              </button>
            )}
          </div>
        </div>

        <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-text-muted" />
              <h2 className="text-sm font-semibold text-text-primary">Últimas movimentações</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('movimentacoes')} className="flex items-center gap-1">
              Ver todas ({movements.length})
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          <div className="divide-y divide-border-subtle">
            {movements.slice(0, 6).map((movement) => (
              <div key={movement.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className={`mt-0.5 w-7 h-7 radius-base flex items-center justify-center shrink-0 ${
                      movement.type === 'Entrega'
                        ? 'bg-status-success-bg text-status-success-fg'
                        : movement.type === 'Devolução'
                          ? 'bg-status-warning-bg text-status-warning-fg'
                          : 'bg-surface-subtle text-brand-blue-action'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-text-primary">{movement.type}</span>
                      <span className="text-[11px] font-code font-bold text-brand-blue-action">
                        {movement.deviceTag || movement.phoneNumber || 'Ativo'}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted truncate">
                      {stockDisplayName(movement.originCollaboratorName)} →{' '}
                      {stockDisplayName(movement.destinationCollaboratorName)}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-code text-text-muted shrink-0">{formatDate(movement.date)}</span>
              </div>
            ))}

            {movements.length === 0 && (
              <div className="py-6 text-center">
                <ArrowLeftRight className="w-8 h-8 text-border-strong mx-auto mb-2" />
                <p className="text-xs font-semibold text-text-primary">Nenhuma movimentação registrada</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  As entregas, devoluções e transferências aparecerão aqui.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Aviso de termos pendentes para administradores */}
      <Modal
        isOpen={isPendingTermsModalOpen}
        onClose={closePendingTermsModal}
        title="Existem termos pendentes de assinatura"
        subtitle={`${pendingTerms.length} documento(s) aguardando assinatura`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 radius-lg border border-status-warning-border bg-status-warning-bg">
            <FileWarning className="w-5 h-5 text-status-warning-fg shrink-0 mt-0.5" />
            <p className="text-[11px] text-status-warning-fg leading-relaxed">
              {firstName ? `${firstName}, existem` : 'Existem'}{' '}
              <strong className="text-text-primary">{pendingTerms.length} termo(s)</strong> gerados e ainda
              não assinados. Regularize com o gestor responsável para manter a documentação patrimonial
              em dia.
            </p>
          </div>

          <div className="divide-y divide-border-subtle border border-border-subtle radius-lg overflow-hidden">
            {pendingTerms.slice(0, 5).map((term) => (
              <div key={term.id} className="px-3 py-2.5 flex items-center justify-between gap-3 bg-surface-card">
                <div className="min-w-0">
                  <span className="text-[11px] font-code font-bold text-text-primary">{term.code}</span>
                  <p className="text-[11px] text-text-muted truncate">
                    {term.collaboratorName || 'Sem colaborador'} · {formatDate(term.date)}
                  </p>
                </div>
                <StatusBadge status={term.status} type="term" size="sm" />
              </div>
            ))}
          </div>

          {pendingTerms.length > 5 && (
            <p className="text-[11px] text-text-muted text-center">
              e mais {pendingTerms.length - 5} termo(s) pendente(s).
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => {
              closePendingTermsModal();
              onNavigate('termos');
            }}>
              Ver termos
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
