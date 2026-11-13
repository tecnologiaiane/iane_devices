import React, { useState } from 'react';
import { dataService, stockDisplayName } from '../services/dataStorage';
import { formatDate, formatCurrency, formatImei, downloadCsv } from '../utils/formatters';
import { todayISO } from '../utils/dates';
import { StatusBadge } from '../components/StatusBadge';
import {
  BarChart3,
  Download,
  Printer,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Building2,
  Smartphone
} from 'lucide-react';

type ReportKey = 
  | 'inventario_completo'
  | 'por_colaborador'
  | 'disponiveis'
  | 'linhas_status'
  | 'linhas_sem_aparelho'
  | 'ativos_departamento'
  | 'movimentacoes_periodo'
  | 'manutencao';

interface ReportOption {
  id: ReportKey;
  title: string;
  description: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: 'inventario_completo',
    title: '1. Inventário Geral Completo de Aparelhos',
    description: 'Relação patrimonial integral de todos os smartphones cadastrados com IMEI, número de série e valores.'
  },
  {
    id: 'por_colaborador',
    title: '2. Aparelhos Atribuídos por Colaborador',
    description: 'Lista de ativos atualmente sob custódia de colaboradores com termos vinculados.'
  },
  {
    id: 'disponiveis',
    title: '3. Aparelhos Livres / Disponíveis em Estoque',
    description: 'Equipamentos prontos para entrega imediata a novas contratações ou substituições.'
  },
  {
    id: 'linhas_status',
    title: '4. Linhas Telefônicas por Operadora e Status',
    description: 'Controle de custos, planos contratados e situação operacional das linhas.'
  },
  {
    id: 'linhas_sem_aparelho',
    title: '5. Linhas Telefônicas Órfãs (Sem Aparelho Associado)',
    description: 'Chips corporativos sem equipamento físico vinculado.'
  },
  {
    id: 'ativos_departamento',
    title: '6. Alocação de Ativos por Departamento',
    description: 'Consolidação de equipamentos distribuídos por centros de custo / setores.'
  },
  {
    id: 'movimentacoes_periodo',
    title: '7. Relatório de Movimentações Patrimoniais',
    description: 'Histórico cronológico de entregas, devoluções, transferências e baixas.'
  },
  {
    id: 'manutencao',
    title: '8. Ativos em Assistência Técnica e Manutenção',
    description: 'Aparelhos em reparo, custos previstos e prazos de retorno.'
  }
];

export const ReportsView: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<ReportKey>('inventario_completo');
  const [departmentFilter, setDepartmentFilter] = useState('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const devices = dataService.getDevices();
  const lines = dataService.getLines();
  const collabs = dataService.getCollaborators();
  const movements = dataService.getMovements();

  const uniqueDepartments = Array.from(new Set(devices.map(d => d.currentDepartment).filter(Boolean))) as string[];

  // Export CSV handler
  const handleExportCsv = () => {
    const timestamp = todayISO();

    if (selectedReport === 'inventario_completo') {
      const headers = ['Tag', 'Marca', 'Modelo', 'IMEI 1', 'IMEI 2', 'Número de Série', 'Status', 'Responsável', 'Linha', 'Departamento', 'Condição', 'Valor (R$)', 'Data Compra'];
      const rows = devices.map(d => [
        d.assetTag,
        d.brand,
        d.model,
        d.imei1,
        d.imei2 || '',
        d.serialNumber,
        d.status,
        d.currentCollaboratorName || 'Estoque',
        d.associatedPhoneNumber || '',
        d.currentDepartment || '',
        d.condition,
        d.purchaseValue ? d.purchaseValue.toFixed(2) : '',
        formatDate(d.purchaseDate)
      ]);
      downloadCsv(`Inventario_Aparelhos_${timestamp}.csv`, [headers, ...rows]);
    } else if (selectedReport === 'por_colaborador') {
      const headers = ['Colaborador', 'Matrícula', 'Departamento', 'Cargo', 'Aparelho Tag', 'Modelo', 'IMEI', 'Linha'];
      const rows: string[][] = [];
      devices.filter(d => d.currentCollaboratorId).forEach(d => {
        const col = collabs.find(c => c.id === d.currentCollaboratorId);
        rows.push([
          d.currentCollaboratorName || '',
          col?.registrationNumber || '',
          d.currentDepartment || '',
          col?.position || '',
          d.assetTag,
          d.model,
          d.imei1,
          d.associatedPhoneNumber || ''
        ]);
      });
      downloadCsv(`Aparelhos_Por_Colaborador_${timestamp}.csv`, [headers, ...rows]);
    } else if (selectedReport === 'linhas_status') {
      const headers = ['Número', 'Operadora', 'Plano', 'Custo Mensal (R$)', 'Status', 'Aparelho Tag', 'Responsável', 'Departamento'];
      const rows = lines.map(l => [
        l.phoneNumber,
        l.carrier,
        l.planName || '',
        l.monthlyCost ? l.monthlyCost.toFixed(2) : '',
        l.status,
        l.associatedDeviceTag || '',
        l.currentCollaboratorName || '',
        l.department || ''
      ]);
      downloadCsv(`Linhas_Telefonicas_${timestamp}.csv`, [headers, ...rows]);
    } else if (selectedReport === 'movimentacoes_periodo') {
      const headers = ['Código', 'Operação Conjunta', 'Data', 'Tipo', 'Aparelho', 'Linha', 'Origem', 'Destino', 'Etapa Estoque', 'Motivo', 'Termo'];
      const rows = movements.map(m => [
        m.code,
        m.batchOperationId || '',
        formatDate(m.date),
        m.type,
        m.deviceTag || '',
        m.phoneNumber || '',
        stockDisplayName(m.originCollaboratorName),
        stockDisplayName(m.destinationCollaboratorName),
        m.stockTransit?.stage || '',
        m.reason || '',
        m.documentCode || ''
      ]);
      downloadCsv(`Relatorio_Movimentacoes_${timestamp}.csv`, [headers, ...rows]);
    } else {
      // Generic fallback
      const headers = ['Identificador', 'Descrição', 'Status', 'Responsável', 'Departamento'];
      const rows = devices.map(d => [d.assetTag, d.model, d.status, d.currentCollaboratorName || 'Estoque', d.currentDepartment || '']);
      downloadCsv(`Relatorio_IANE_Dispositivos_${timestamp}.csv`, [headers, ...rows]);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Report Selection Grid */}
      <div className="bg-surface p-5 rounded-xl border border-line shadow-xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-text">Módulo de Relatórios e Auditoria Patrimonial</h2>
            <p className="text-xs text-muted">Selecione o modelo desejado para análise ou exportação</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-text bg-subtle hover:bg-line transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-muted" />
              <span>Imprimir Relatório</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-ok-bg bg-ok-fg hover:opacity-90 shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Planilha (CSV)</span>
            </button>
          </div>
        </div>

        {/* Report selection buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-line">
          {REPORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedReport(opt.id)}
              className={`p-3 text-left rounded-lg border text-xs transition-all ${
                selectedReport === opt.id
                  ? 'border-accent bg-info-bg/70 text-accent font-semibold shadow-xs'
                  : 'border-line bg-surface text-text hover:bg-subtle hover:border-line-strong'
              }`}
            >
              <div className="font-bold text-text truncate mb-1">{opt.title}</div>
              <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Render Selected Report View */}
      <div className="bg-surface rounded-xl border border-line shadow-xs overflow-hidden p-6 space-y-4">
        {/* Printable Title Bar */}
        <div className="border-b border-line pb-3 flex justify-between items-end">
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase text-muted block">
              Relatório Patrimonial
            </span>
            <h2 className="text-base font-bold text-text">
              {REPORT_OPTIONS.find(o => o.id === selectedReport)?.title}
            </h2>
          </div>
          <span className="text-xs text-muted font-mono">
            Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR').substring(0, 5)}
          </span>
        </div>

        {/* 1. Inventário Geral */}
        {selectedReport === 'inventario_completo' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-subtle border-b border-line font-semibold text-text text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Tag</th>
                  <th className="py-2.5 px-3">Marca / Modelo</th>
                  <th className="py-2.5 px-3">IMEI 1</th>
                  <th className="py-2.5 px-3">S/N</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3">Linha</th>
                  <th className="py-2.5 px-3">Setor</th>
                  <th className="py-2.5 px-3 text-right">Valor Compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-subtle/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-text">{d.assetTag}</td>
                    <td className="py-2.5 px-3 font-medium text-text">{d.model}</td>
                    <td className="py-2.5 px-3 font-mono text-muted">{formatImei(d.imei1)}</td>
                    <td className="py-2.5 px-3 font-mono text-muted">{d.serialNumber}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={d.status} type="device" size="sm" /></td>
                    <td className="py-2.5 px-3">{d.currentCollaboratorName || <span className="text-muted italic">Disponível</span>}</td>
                    <td className="py-2.5 px-3 font-mono">{d.associatedPhoneNumber || '-'}</td>
                    <td className="py-2.5 px-3">{d.currentDepartment || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatCurrency(d.purchaseValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. Por Colaborador */}
        {selectedReport === 'por_colaborador' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-subtle border-b border-line font-semibold text-text text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Colaborador</th>
                  <th className="py-2.5 px-3">Matrícula</th>
                  <th className="py-2.5 px-3">Departamento</th>
                  <th className="py-2.5 px-3">Cargo</th>
                  <th className="py-2.5 px-3">Aparelho Alocado</th>
                  <th className="py-2.5 px-3">IMEI</th>
                  <th className="py-2.5 px-3">Linha Vinculada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {devices.filter(d => d.currentCollaboratorId).map((d) => {
                  const col = collabs.find(c => c.id === d.currentCollaboratorId);
                  return (
                    <tr key={d.id} className="hover:bg-subtle/50">
                      <td className="py-2.5 px-3 font-bold text-text">{d.currentCollaboratorName}</td>
                      <td className="py-2.5 px-3 font-mono">{col?.registrationNumber}</td>
                      <td className="py-2.5 px-3">{d.currentDepartment}</td>
                      <td className="py-2.5 px-3 text-muted">{col?.position}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-accent">{d.assetTag} ({d.model})</td>
                      <td className="py-2.5 px-3 font-mono text-muted">{formatImei(d.imei1)}</td>
                      <td className="py-2.5 px-3 font-mono text-ok-fg font-semibold">{d.associatedPhoneNumber || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Disponíveis */}
        {selectedReport === 'disponiveis' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-subtle border-b border-line font-semibold text-text text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Tag</th>
                  <th className="py-2.5 px-3">Modelo</th>
                  <th className="py-2.5 px-3">IMEI</th>
                  <th className="py-2.5 px-3">Condição</th>
                  <th className="py-2.5 px-3">Linha Associada</th>
                  <th className="py-2.5 px-3">Observações de Estoque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {devices.filter(d => d.status === dataService.getCatalogStatus('deviceStatuses', 'device-status-available', 'Disponível')).map((d) => (
                  <tr key={d.id} className="hover:bg-subtle/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-text">{d.assetTag}</td>
                    <td className="py-2.5 px-3 font-medium text-text">{d.model}</td>
                    <td className="py-2.5 px-3 font-mono text-muted">{formatImei(d.imei1)}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={d.condition} type="condition" size="sm" /></td>
                    <td className="py-2.5 px-3 font-mono">{d.associatedPhoneNumber || 'Sem linha'}</td>
                    <td className="py-2.5 px-3 text-muted">{d.notes || 'Pronto para uso.'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Linhas por status */}
        {selectedReport === 'linhas_status' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-subtle border-b border-line font-semibold text-text text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Número</th>
                  <th className="py-2.5 px-3">Operadora</th>
                  <th className="py-2.5 px-3">Plano Contratado</th>
                  <th className="py-2.5 px-3">Custo Mensal</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Aparelho Associado</th>
                  <th className="py-2.5 px-3">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.map((l) => (
                  <tr key={l.id} className="hover:bg-subtle/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-text">{l.phoneNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-text">{l.carrier}</td>
                    <td className="py-2.5 px-3 text-text">{l.planName || 'Não informado'}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{formatCurrency(l.monthlyCost)}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={l.status} type="line" size="sm" /></td>
                    <td className="py-2.5 px-3 font-mono">{l.associatedDeviceTag || '-'}</td>
                    <td className="py-2.5 px-3">{l.currentCollaboratorName || <span className="text-muted italic">Disponível</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Linhas sem aparelho */}
        {selectedReport === 'linhas_sem_aparelho' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-subtle border-b border-line font-semibold text-text text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Número</th>
                  <th className="py-2.5 px-3">Operadora</th>
                  <th className="py-2.5 px-3">Plano</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lines.filter(l => !l.associatedDeviceId).map((l) => (
                  <tr key={l.id} className="hover:bg-subtle/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-text">{l.phoneNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-text">{l.carrier}</td>
                    <td className="py-2.5 px-3 text-text">{l.planName || 'Não informado'}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={l.status} type="line" size="sm" /></td>
                    <td className="py-2.5 px-3">{l.currentCollaboratorName || <span className="text-muted italic">Sem responsável (Chip no cofre)</span>}</td>
                    <td className="py-2.5 px-3 text-muted">{l.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. Movimentações */}
        {selectedReport === 'movimentacoes_periodo' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-subtle border-b border-line font-semibold text-text text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Ativo</th>
                  <th className="py-2.5 px-3">Linha</th>
                  <th className="py-2.5 px-3">Origem & Destino</th>
                  <th className="py-2.5 px-3">Motivo</th>
                  <th className="py-2.5 px-3">Termo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-subtle/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-text">{m.code}</td>
                    <td className="py-2.5 px-3 font-mono">{formatDate(m.date)}</td>
                    <td className="py-2.5 px-3 font-semibold">{m.type}</td>
                    <td className="py-2.5 px-3 font-mono text-accent">{m.deviceTag || '-'}</td>
                    <td className="py-2.5 px-3 font-mono">{m.phoneNumber || '-'}</td>
                    <td className="py-2.5 px-3 text-text">
                      {m.originCollaboratorName ? `De: ${stockDisplayName(m.originCollaboratorName)} ` : ''}
                      {m.destinationCollaboratorName ? `Para: ${stockDisplayName(m.destinationCollaboratorName)}` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-muted">{m.reason || '-'}</td>
                    <td className="py-2.5 px-3 font-mono text-accent font-semibold">{m.documentCode || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 8. Manutenção */}
        {selectedReport === 'manutencao' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-subtle border-b border-line font-semibold text-text text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Tag</th>
                  <th className="py-2.5 px-3">Modelo</th>
                  <th className="py-2.5 px-3">IMEI</th>
                  <th className="py-2.5 px-3">Condição</th>
                  <th className="py-2.5 px-3">Histórico / Assistência Técnica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {devices.filter(d => d.status === dataService.getCatalogStatus('deviceStatuses', 'device-status-maintenance', 'Em manutenção')).map((d) => (
                  <tr key={d.id} className="hover:bg-subtle/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-text">{d.assetTag}</td>
                    <td className="py-2.5 px-3 font-medium text-text">{d.model}</td>
                    <td className="py-2.5 px-3 font-mono text-muted">{formatImei(d.imei1)}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={d.condition} type="condition" size="sm" /></td>
                    <td className="py-2.5 px-3 text-text">{d.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
