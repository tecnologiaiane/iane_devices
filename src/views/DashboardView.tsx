import React, { useEffect, useState } from 'react';
import { dataService } from '../services/dataStorage';
import { formatDate } from '../utils/formatters';
import { SECTORS } from '../utils/collaborators';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { NavTab } from '../components/Sidebar';
import { User } from '../types';
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

// DDDs exibidos no resumo de linhas e utilitário de extração.
const TARGET_DDDS = ['83', '71', '84'];

/**
 * Extrai o DDD de um número de telefone, ignorando máscara, código do país (+55)
 * e o zero de discagem inicial. Retorna null quando não há DDD identificável.
 */
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
  const metrics = dataService.getDashboardMetrics();
  const devices = dataService.getDevices();
  const lines = dataService.getLines();
  const movements = dataService.getMovements();
  const terms = dataService.getTerms();
  const collaborators = dataService.getCollaborators();

  const permissions = currentUser?.permissions || ['all'];
  const isAdmin = currentUser?.role === 'admin' || permissions.includes('all');

  const pendingTerms = terms.filter((t) => t.status === 'Pendente de Assinatura');
  const signedTerms = terms.filter((t) => t.status === 'Assinado');
  const archivedTerms = terms.filter((t) => t.status === 'Arquivado');

  const [isPendingTermsModalOpen, setIsPendingTermsModalOpen] = useState(false);

  // Aviso de termos pendentes: somente para administradores e uma vez por sessão.
  // Se a quantidade mudar (novos termos), o aviso volta a aparecer.
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

  // --- Indicadores derivados ---
  const statusSegments = [
    { label: 'Em uso', count: metrics.inUseDevices, color: '#0178C8' },
    { label: 'Disponíveis', count: metrics.stockAvailable, color: '#10B981' },
    { label: 'Aguardando avaliação', count: metrics.stockAwaitingEvaluation, color: '#E7C800' },
    { label: 'Em manutenção', count: metrics.stockMaintenance, color: '#F97316' },
    { label: 'Reservados', count: metrics.stockReserved, color: '#A855F7' },
    { label: 'Aguardando baixa', count: metrics.stockAwaitingDisposal, color: '#6B7494' },
    { label: 'Baixados', count: metrics.stockDisposed, color: '#C5CCDD' },
    { label: 'Extraviados', count: metrics.lostDevices, color: '#E11D48' },
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

  const evaluatingDevices = devices.filter((d) => d.status === 'Aguardando avaliação');
  const maintenanceDevices = devices.filter((d) => d.status === 'Em manutenção');
  const attentionDevices = [...evaluatingDevices, ...maintenanceDevices];

  const activeCollaborators = collaborators.filter((c) => c.status === 'Ativo').length;
  const signedTermsPercent = terms.length > 0 ? Math.round((signedTerms.length / terms.length) * 100) : 0;

  // Resumo de linhas: apenas os DDDs 083, 071 e 084, na ordem fixa.
  const dddRows = TARGET_DDDS.map((ddd) => ({
    ddd: `0${ddd}`,
    active: lines.filter((l) => extractDdd(l.phoneNumber) === ddd && l.status === 'Ativa').length,
    available: lines.filter((l) => extractDdd(l.phoneNumber) === ddd && l.status === 'Disponível').length,
  }));
  const linesOutsideTargetDdds = lines.filter((l) => {
    const ddd = extractDdd(l.phoneNumber);
    return !ddd || !TARGET_DDDS.includes(ddd);
  }).length;

  // Aparelhos em uso por Setor (vínculo atual do aparelho com o colaborador).
  const collaboratorsById = new Map(collaborators.map((c) => [c.id, c]));
  const inUseBySector = new Map<string, number>(SECTORS.map((sector) => [sector, 0]));
  let inUseWithoutSector = 0;
  devices.forEach((device) => {
    if (device.status !== 'Em uso') return;
    const collaborator = device.currentCollaboratorId
      ? collaboratorsById.get(device.currentCollaboratorId)
      : undefined;
    const sector = collaborator?.sector?.trim();
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
      {/* Card único e informativo com os totais (sem navegação) */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-ink-200 border-t-[3px] border-t-iane-500 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <div className="flex items-center justify-between text-ink-500 mb-1">
              <span className="text-xs font-medium">Aparelhos</span>
              <Smartphone className="w-4 h-4 text-iane-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-ink-900">
              {metrics.totalDevices}
            </div>
            <div className="mt-1.5 text-[11px] text-ink-500">Cadastrados na frota</div>
          </div>

          <div>
            <div className="flex items-center justify-between text-ink-500 mb-1">
              <span className="text-xs font-medium">Em uso</span>
              <Users className="w-4 h-4 text-iane-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-ink-900">
              {metrics.inUseDevices}
            </div>
            <div className="mt-1.5 text-[11px] text-iane-700 font-medium">
              {percent(metrics.inUseDevices)}% com colaboradores
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-ink-500 mb-1">
              <span className="text-xs font-medium">No estoque</span>
              <Package className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-ink-900">
              {metrics.stockTotal}
            </div>
            <div className="mt-1.5 text-[11px] text-ink-500">Sob custódia de TI</div>
          </div>

          <div>
            <div className="flex items-center justify-between text-emerald-800 mb-1">
              <span className="text-xs font-bold">Disponíveis</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-900">
              {metrics.stockAvailable}
            </div>
            <div className="mt-1.5 text-[11px] text-emerald-700 font-medium">Prontos para entrega</div>
          </div>

          <div>
            <div className="flex items-center justify-between text-ink-500 mb-1">
              <span className="text-xs font-medium">Em manutenção</span>
              <Wrench className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-orange-700">
              {metrics.stockMaintenance}
            </div>
            <div className="mt-1.5 text-[11px] text-ink-500">Em assistência técnica</div>
          </div>

          <div>
            <div className="flex items-center justify-between text-ink-500 mb-1">
              <span className="text-xs font-medium">Linhas ativas</span>
              <PhoneCall className="w-4 h-4 text-iane-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-ink-900">
              {metrics.activeLines}
            </div>
            <div className="mt-1.5 text-[11px] text-ink-500">
              <span className="text-emerald-700 font-semibold tabular-nums">{metrics.availableLines}</span> livres
              {' · '}
              {metrics.totalLines} no total
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos e resumos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status dos aparelhos (donut) */}
        <div className="bg-white p-5 rounded-xl border border-ink-200 shadow-xs">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-ink-900">Status dos aparelhos</h2>
              <p className="text-xs text-ink-500">Como a frota está distribuída hoje</p>
            </div>
            <Smartphone className="w-4 h-4 text-ink-400" />
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
                <span className="text-2xl font-bold font-mono tabular-nums text-ink-900">
                  {metrics.totalDevices}
                </span>
                <span className="text-[10px] text-ink-500 uppercase tracking-wider">aparelhos</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2">
              {statusSegments.map((segment) => (
                <div key={segment.label} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                    <span className="text-ink-700 truncate">{segment.label}</span>
                  </div>
                  <span className="font-mono text-ink-600 tabular-nums shrink-0">
                    {segment.count} <span className="text-ink-400">({percent(segment.count)}%)</span>
                  </span>
                </div>
              ))}
              {statusSegments.length === 0 && (
                <p className="text-xs text-ink-500">Nenhum aparelho cadastrado ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* Resumo de linhas por DDD */}
        <div className="bg-white rounded-xl border border-ink-200 shadow-xs flex flex-col">
          <div className="px-5 pt-5 pb-3 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink-900">Resumo de linhas</h2>
              <p className="text-xs text-ink-500">Ativas e disponíveis por DDD</p>
            </div>
            <PhoneCall className="w-4 h-4 text-ink-400" />
          </div>

          <div className="flex-1 overflow-y-auto max-h-64">
            <table className="w-full text-xs border-collapse">
              <thead className="text-ink-600 uppercase font-semibold tracking-wider text-[11px]">
                <tr>
                  <th className="sticky top-0 bg-ink-50 py-2 px-4 text-left border-y border-ink-200">DDD</th>
                  <th className="sticky top-0 bg-ink-50 py-2 px-4 text-center border-y border-ink-200">Ativas</th>
                  <th className="sticky top-0 bg-ink-50 py-2 px-4 text-center border-y border-ink-200">Disponíveis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {dddRows.map((row, index) => (
                  <tr key={row.ddd} className={index % 2 === 1 ? 'bg-ink-50/60' : undefined}>
                    <td className="py-2.5 px-4 font-mono font-semibold text-ink-800">{row.ddd}</td>
                    <td className="py-2.5 px-4 text-center font-mono tabular-nums text-ink-900">{row.active}</td>
                    <td className="py-2.5 px-4 text-center font-mono tabular-nums text-emerald-700">{row.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-ink-100 text-[11px] text-ink-500">
            {linesOutsideTargetDdds} linha(s) fora dos DDDs 083, 071 e 084.
          </div>
        </div>

        {/* Termos e documentos */}
        <div className="bg-white p-5 rounded-xl border border-ink-200 shadow-xs flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-ink-900">Termos e documentos</h2>
              <p className="text-xs text-ink-500">Assinaturas e arquivos de guarda</p>
            </div>
            <FileText className="w-4 h-4 text-ink-400" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 bg-sun-50 border border-sun-300 rounded-lg">
              <div className="text-lg font-bold font-mono tabular-nums text-gold-700">{pendingTerms.length}</div>
              <div className="text-[10px] font-medium text-gold-700">Pendentes</div>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-800">{signedTerms.length}</div>
              <div className="text-[10px] font-medium text-emerald-800">Assinados</div>
            </div>
            <div className="p-2.5 bg-ink-50 border border-ink-200 rounded-lg">
              <div className="text-lg font-bold font-mono tabular-nums text-ink-700">{archivedTerms.length}</div>
              <div className="text-[10px] font-medium text-ink-600">Arquivados</div>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 flex-1">
            <div className="flex items-center justify-between text-[11px] text-ink-500">
              <span>Documentos assinados</span>
              <span className="font-mono tabular-nums">{signedTermsPercent}%</span>
            </div>
            <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${signedTermsPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-ink-500 pt-1">
              {signedTerms.length} de {terms.length} documentos concluídos.
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-ink-100 flex items-center justify-between">
            <span className="text-[11px] text-ink-500">{pendingTerms.length} aguardando assinatura</span>
            <button
              type="button"
              onClick={() => onNavigate('termos')}
              className="text-[11px] font-semibold text-iane-600 hover:text-iane-800 inline-flex items-center gap-1"
            >
              Abrir termos
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Departamentos, fabricantes e aparelhos por setor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-ink-200 shadow-xs">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-ink-900">Aparelhos por departamento</h2>
              <p className="text-xs text-ink-500">Onde a frota está alocada</p>
            </div>
            <Building2 className="w-4 h-4 text-ink-400" />
          </div>

          <div className="space-y-3">
            {devicesByDepartment.slice(0, 6).map(([department, count]) => (
              <div key={department} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-medium text-ink-700 truncate">{department}</span>
                  <span className="font-mono text-ink-600 tabular-nums shrink-0">{count}</span>
                </div>
                <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-navy-700 rounded-full"
                    style={{ width: `${Math.round((count / maxDepartmentCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {devicesByDepartment.length === 0 && (
              <p className="text-xs text-ink-500">Nenhum aparelho alocado.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-ink-200 shadow-xs">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-ink-900">Aparelhos por fabricante</h2>
              <p className="text-xs text-ink-500">Marcas presentes na frota</p>
            </div>
            <Tag className="w-4 h-4 text-ink-400" />
          </div>

          <div className="flex flex-wrap gap-2">
            {devicesByBrand.slice(0, 10).map(([brand, count]) => (
              <span
                key={brand}
                className="text-xs px-2.5 py-1.5 bg-ink-50 border border-ink-200 rounded-lg font-medium text-ink-800"
              >
                {brand}
                <span className="ml-1.5 font-mono font-bold text-iane-700 tabular-nums">{count}</span>
              </span>
            ))}
            {devicesByBrand.length === 0 && (
              <p className="text-xs text-ink-500">Nenhum fabricante registrado.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-ink-100 grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-ink-500 block">Colaboradores ativos</span>
              <span className="text-base font-bold font-mono tabular-nums text-ink-900">{activeCollaborators}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-ink-500 block">Sem aparelho</span>
              <span className="text-base font-bold font-mono tabular-nums text-ink-900">{metrics.devicesWithoutCollaborator}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-ink-200 shadow-xs flex flex-col">
          <div className="px-5 pt-5 pb-3 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink-900">Aparelhos por Setor</h2>
              <p className="text-xs text-ink-500">Aparelhos em uso por setor do colaborador</p>
            </div>
            <Building2 className="w-4 h-4 text-ink-400" />
          </div>

          <div className="flex-1 overflow-y-auto max-h-64">
            <table className="w-full text-xs border-collapse">
              <thead className="text-ink-600 uppercase font-semibold tracking-wider text-[11px]">
                <tr>
                  <th className="sticky top-0 bg-ink-50 py-2 px-4 text-left border-y border-ink-200">Setor</th>
                  <th className="sticky top-0 bg-ink-50 py-2 px-4 text-center border-y border-ink-200">Em Uso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {SECTORS.map((sector, index) => (
                  <tr key={sector} className={index % 2 === 1 ? 'bg-ink-50/60' : undefined}>
                    <td className="py-2.5 px-4 font-medium text-ink-800">{sector}</td>
                    <td className="py-2.5 px-4 text-center font-mono tabular-nums text-ink-900">
                      {inUseBySector.get(sector) || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-ink-100 text-[11px] text-ink-500">
            {inUseWithoutSector} aparelho(s) em uso sem Setor definido.
          </div>
        </div>
      </div>

      {/* Listas operacionais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-ink-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-gold-700" />
              <h2 className="text-sm font-bold text-ink-900">Atenção necessária</h2>
            </div>
            <span className="text-[11px] text-ink-500 font-medium">
              {attentionDevices.length} aparelho(s)
            </span>
          </div>

          <div className="space-y-2.5">
            {attentionDevices.slice(0, 6).map((device) => (
              <div
                key={device.id}
                className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                  device.status === 'Em manutenção'
                    ? 'bg-orange-50/70 border-orange-200'
                    : 'bg-sun-50/70 border-sun-300'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink-900 font-mono text-xs">{device.assetTag}</span>
                    <StatusBadge status={device.status} type="device" size="sm" />
                  </div>
                  <p className="text-[11px] text-ink-600 truncate">
                    {device.brand} {device.model}
                    {device.notes ? ` · ${device.notes}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('dispositivos')}
                  className="text-[11px] font-semibold text-iane-700 hover:text-iane-900 hover:underline shrink-0"
                >
                  Abrir
                </button>
              </div>
            ))}

            {attentionDevices.length === 0 && (
              <div className="py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-ink-700">Nenhuma pendência no estoque</p>
                <p className="text-[11px] text-ink-500 mt-0.5">
                  Não há aparelhos aguardando avaliação ou em manutenção.
                </p>
              </div>
            )}
          </div>

          {attentionDevices.length > 6 && (
            <button
              type="button"
              onClick={() => onNavigate('dispositivos')}
              className="mt-3 w-full py-2 text-[11px] font-semibold text-iane-600 bg-iane-50 hover:bg-iane-100 rounded-lg transition-colors"
            >
              Ver todos os {attentionDevices.length} aparelhos
            </button>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-ink-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-ink-500" />
              <h2 className="text-sm font-bold text-ink-900">Últimas movimentações</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('movimentacoes')}
              className="text-[11px] font-semibold text-iane-600 hover:text-iane-800 inline-flex items-center gap-1"
            >
              Ver todas ({movements.length})
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-ink-100">
            {movements.slice(0, 6).map((movement) => (
              <div key={movement.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      movement.type === 'Entrega'
                        ? 'bg-emerald-50 text-emerald-600'
                        : movement.type === 'Devolução'
                          ? 'bg-sun-50 text-gold-700'
                          : 'bg-iane-50 text-iane-600'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-ink-900">{movement.type}</span>
                      <span className="text-[11px] font-mono font-bold text-iane-700">
                        {movement.deviceTag || movement.phoneNumber || 'Ativo'}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-500 truncate">
                      {movement.originCollaboratorName || 'Estoque'} →{' '}
                      {movement.destinationCollaboratorName || 'Estoque'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-ink-500 shrink-0">{formatDate(movement.date)}</span>
              </div>
            ))}

            {movements.length === 0 && (
              <div className="py-6 text-center">
                <ArrowLeftRight className="w-8 h-8 text-ink-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-ink-700">Nenhuma movimentação registrada</p>
                <p className="text-[11px] text-ink-500 mt-0.5">
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
          <div className="flex items-start gap-3 p-4 rounded-xl bg-sun-50 border border-sun-300">
            <FileWarning className="w-5 h-5 text-gold-700 shrink-0 mt-0.5" />
            <p className="text-xs text-gold-700 leading-relaxed">
              {firstName ? `${firstName}, existem` : 'Existem'}{' '}
              <strong className="text-ink-900">{pendingTerms.length} termo(s)</strong> gerados e ainda
              não assinados. Regularize com o gestor responsável para manter a documentação patrimonial
              em dia.
            </p>
          </div>

          <div className="divide-y divide-ink-100 border border-ink-200 rounded-lg overflow-hidden">
            {pendingTerms.slice(0, 5).map((term) => (
              <div key={term.id} className="px-3 py-2.5 flex items-center justify-between gap-3 bg-white">
                <div className="min-w-0">
                  <span className="text-xs font-mono font-bold text-ink-900">{term.code}</span>
                  <p className="text-[11px] text-ink-500 truncate">
                    {term.collaboratorName || 'Sem colaborador'} · {formatDate(term.date)}
                  </p>
                </div>
                <StatusBadge status={term.status} type="term" size="sm" />
              </div>
            ))}
          </div>

          {pendingTerms.length > 5 && (
            <p className="text-[11px] text-ink-500 text-center">
              e mais {pendingTerms.length - 5} termo(s) pendente(s).
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                closePendingTermsModal();
                onNavigate('termos');
              }}
              className="px-4 py-2 text-xs font-semibold text-iane-700 bg-iane-50 hover:bg-iane-100 border border-iane-200 rounded-lg transition-colors"
            >
              Ver termos
            </button>
            <button
              type="button"
              onClick={closePendingTermsModal}
              className="px-5 py-2 text-xs font-semibold text-white bg-iane-600 hover:bg-iane-700 rounded-lg shadow-xs transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
