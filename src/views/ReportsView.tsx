import React, { useState } from 'react';
import { dataService, stockDisplayName } from '../services/dataStorage';
import { formatDate, formatCurrency, formatImei, downloadCsv } from '../utils/formatters';
import { todayISO } from '../utils/dates';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/button';
import {
  BarChart3,
  Download,
  Printer,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Building2,
  Smartphone,
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
		description: 'Relação patrimonial integral de todos os smartphones cadastrados com IMEI, número de série e valores.',
	},
	{
		id: 'por_colaborador',
		title: '2. Aparelhos Atribuídos por Colaborador',
		description: 'Lista de ativos atualmente sob custódia de colaboradores com termos vinculados.',
	},
	{
		id: 'disponiveis',
		title: '3. Aparelhos Livres / Disponíveis em Estoque',
		description: 'Equipamentos prontos para entrega imediata a novas contratações ou substituições.',
	},
	{
		id: 'linhas_status',
		title: '4. Linhas Telefônicas por Operadora e Status',
		description: 'Controle de custos, planos contratados e situação operacional das linhas.',
	},
	{
		id: 'linhas_sem_aparelho',
		title: '5. Linhas Telefônicas Órfãs (Sem Aparelho Associado)',
		description: 'Chips corporativos sem equipamento físico vinculado.',
	},
	{
		id: 'ativos_departamento',
		title: '6. Alocação de Ativos por Departamento',
		description: 'Consolidação de equipamentos distribuídos por centros de custo / setores.',
	},
	{
		id: 'movimentacoes_periodo',
		title: '7. Relatório de Movimentações Patrimoniais',
		description: 'Histórico cronológico de entregas, devoluções, transferências e baixas.',
	},
	{
		id: 'manutencao',
		title: '8. Ativos em Assistência Técnica e Manutenção',
		description: 'Aparelhos em reparo, custos previstos e prazos de retorno.',
	},
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
			<div className="radius-lg border border-border-subtle bg-surface-card shadow-sm p-4 space-y-4 no-print">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<h2 className="text-sm font-semibold text-text-primary">Módulo de Relatórios e Auditoria Patrimonial</h2>
						<p className="text-[11px] text-text-muted">Selecione o modelo desejado para análise ou exportação</p>
					</div>

					<div className="flex items-center gap-2">
						<Button variant="ghost" size="sm" onClick={handlePrint} className="flex items-center gap-1.5">
							<Printer className="w-3.5 h-3.5" />
							<span>Imprimir Relatório</span>
						</Button>

						<Button variant="primary" size="sm" onClick={handleExportCsv} className="flex items-center gap-1.5">
							<Download className="w-3.5 h-3.5" />
							<span>Exportar Planilha (CSV)</span>
						</Button>
					</div>
				</div>

				{/* Report selection buttons */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-border-subtle">
					{REPORT_OPTIONS.map((opt) => (
						<button
							key={opt.id}
							onClick={() => setSelectedReport(opt.id)}
							className={`p-3 text-left radius-base border text-[11px] transition-all ${
								selectedReport === opt.id
									? 'border-brand-blue-action bg-brand-blue-action/10 text-brand-navy-base font-semibold shadow-sm'
									: 'border-border-subtle bg-surface-card text-text-muted hover:bg-surface-subtle hover:border-border-strong'
							}`}
						>
							<div className="font-semibold text-text-primary truncate mb-1">{opt.title}</div>
							<p className="text-[10px] text-text-muted line-clamp-2 leading-relaxed">{opt.description}</p>
						</button>
					))}
				</div>
			</div>

			{/* Render Selected Report View */}
			<div className="radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden p-4 space-y-4 no-print">
				{/* Printable Title Bar */}
				<div className="border-b border-border-subtle pb-3 flex justify-between items-end">
					<div>
						<span className="text-[10px] font-code font-semibold uppercase text-text-muted block">
							Relatório Patrimonial
						</span>
						<h2 className="text-sm font-semibold text-text-primary">
							{REPORT_OPTIONS.find(o => o.id === selectedReport)?.title}
						</h2>
					</div>
					<span className="text-[10px] font-code text-text-muted">
						Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR').substring(0, 5)}
					</span>
				</div>

				{/* 1. Inventário Geral */}
				{selectedReport === 'inventario_completo' && (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-[11px] border-collapse">
							<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
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
							<tbody className="divide-y divide-border-subtle">
								{devices.map((d) => (
									<tr key={d.id} className="hover:bg-surface-subtle transition-colors">
										<td className="py-2.5 px-3 font-code font-bold text-text-primary">{d.assetTag}</td>
										<td className="py-2.5 px-3 font-medium text-text-primary">{d.model}</td>
										<td className="py-2.5 px-3 font-code text-text-muted">{formatImei(d.imei1)}</td>
										<td className="py-2.5 px-3 font-code text-text-muted">{d.serialNumber}</td>
										<td className="py-2.5 px-3"><StatusBadge status={d.status} type="device" size="sm" /></td>
										<td className="py-2.5 px-3">{d.currentCollaboratorName || <span className="text-text-muted italic font-body">Disponível</span>}</td>
										<td className="py-2.5 px-3 font-code">{d.associatedPhoneNumber || '-'}</td>
										<td className="py-2.5 px-3">{d.currentDepartment || '-'}</td>
										<td className="py-2.5 px-3 text-right font-code tabular-nums">{formatCurrency(d.purchaseValue)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* 2. Por Colaborador */}
				{selectedReport === 'por_colaborador' && (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-[11px] border-collapse">
							<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
								<tr>
									<th className="py-2.5 px-3">Colaborador</th>
									<th className="py-2.5 px-3">Matrícula</th>
									<th className="py-2.5 px-3">Departamento</th>
									<th className="py-2.5 px-3">Cargo</th>
									<th className="py-2.5 px-3">Aparelho Tag</th>
									<th className="py-2.5 px-3">Modelo</th>
									<th className="py-2.5 px-3">IMEI</th>
									<th className="py-2.5 px-3">Linha</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border-subtle">
								{devices.filter(d => d.currentCollaboratorId).map(d => {
									const col = collabs.find(c => c.id === d.currentCollaboratorId);
									return (
										<tr key={d.id} className="hover:bg-surface-subtle transition-colors">
											<td className="py-2.5 px-3 font-medium text-text-primary">{d.currentCollaboratorName || ''}</td>
											<td className="py-2.5 px-3 font-code text-text-muted">{col?.registrationNumber || ''}</td>
											<td className="py-2.5 px-3 text-text-muted">{d.currentDepartment || ''}</td>
											<td className="py-2.5 px-3 text-text-muted">{col?.position || ''}</td>
											<td className="py-2.5 px-3 font-code text-text-primary">{d.assetTag}</td>
											<td className="py-2.5 px-3 text-text-muted">{d.model}</td>
											<td className="py-2.5 px-3 font-code text-text-muted">{d.imei1}</td>
											<td className="py-2.5 px-3 font-code">{d.associatedPhoneNumber || ''}</td>
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
						<table className="w-full text-left text-[11px] border-collapse">
							<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
								<tr>
									<th className="py-2.5 px-3">Tag</th>
									<th className="py-2.5 px-3">Marca / Modelo</th>
									<th className="py-2.5 px-3">IMEI 1</th>
									<th className="py-2.5 px-3">S/N</th>
									<th className="py-2.5 px-3">Condição</th>
									<th className="py-2.5 px-3">Departamento</th>
									<th className="py-2.5 px-3 text-right">Valor Compra</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border-subtle">
								{devices.filter(d => d.status === 'Disponível').map(d => (
									<tr key={d.id} className="hover:bg-surface-subtle transition-colors">
										<td className="py-2.5 px-3 font-code font-bold text-text-primary">{d.assetTag}</td>
										<td className="py-2.5 px-3 font-medium text-text-primary">{d.model}</td>
										<td className="py-2.5 px-3 font-code text-text-muted">{formatImei(d.imei1)}</td>
										<td className="py-2.5 px-3 font-code text-text-muted">{d.serialNumber}</td>
										<td className="py-2.5 px-3"><StatusBadge status={d.condition} type="condition" size="sm" /></td>
										<td className="py-2.5 px-3 text-text-muted">{d.currentDepartment || '-'}</td>
										<td className="py-2.5 px-3 text-right font-code tabular-nums">{formatCurrency(d.purchaseValue)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* 4. Linhas por Status */}
				{selectedReport === 'linhas_status' && (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-[11px] border-collapse">
							<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
								<tr>
									<th className="py-2.5 px-3">Número</th>
									<th className="py-2.5 px-3">Operadora</th>
									<th className="py-2.5 px-3">Plano</th>
									<th className="py-2.5 px-3">Custo Mensal</th>
									<th className="py-2.5 px-3">Status</th>
									<th className="py-2.5 px-3">Aparelho Tag</th>
									<th className="py-2.5 px-3">Responsável</th>
									<th className="py-2.5 px-3">Departamento</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border-subtle">
								{lines.map(l => (
									<tr key={l.id} className="hover:bg-surface-subtle transition-colors">
										<td className="py-2.5 px-3 font-code text-text-primary">{l.phoneNumber}</td>
										<td className="py-2.5 px-3 font-medium text-text-primary">{l.carrier}</td>
										<td className="py-2.5 px-3 text-text-muted">{l.planName || ''}</td>
										<td className="py-2.5 px-3 font-code tabular-nums text-text-muted">{l.monthlyCost ? l.monthlyCost.toFixed(2) : ''}</td>
										<td className="py-2.5 px-3"><StatusBadge status={l.status} type="line" size="sm" /></td>
										<td className="py-2.5 px-3 font-code text-text-muted">{l.associatedDeviceTag || ''}</td>
										<td className="py-2.5 px-3 text-text-muted">{l.currentCollaboratorName || ''}</td>
										<td className="py-2.5 px-3 text-text-muted">{l.department || ''}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* 5. Linhas Sem Aparelho */}
				{selectedReport === 'linhas_sem_aparelho' && (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-[11px] border-collapse">
							<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
								<tr>
									<th className="py-2.5 px-3">Número</th>
									<th className="py-2.5 px-3">Operadora</th>
									<th className="py-2.5 px-3">Plano</th>
									<th className="py-2.5 px-3">Custo Mensal</th>
									<th className="py-2.5 px-3">Status</th>
									<th className="py-2.5 px-3">Departamento</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border-subtle">
								{lines.filter(l => !l.associatedDeviceId).map(l => (
									<tr key={l.id} className="hover:bg-surface-subtle transition-colors">
										<td className="py-2.5 px-3 font-code text-text-primary">{l.phoneNumber}</td>
										<td className="py-2.5 px-3 font-medium text-text-primary">{l.carrier}</td>
										<td className="py-2.5 px-3 text-text-muted">{l.planName || ''}</td>
										<td className="py-2.5 px-3 font-code tabular-nums text-text-muted">{l.monthlyCost ? l.monthlyCost.toFixed(2) : ''}</td>
										<td className="py-2.5 px-3"><StatusBadge status={l.status} type="line" size="sm" /></td>
										<td className="py-2.5 px-3 text-text-muted">{l.department || ''}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* 6. Ativos por Departamento */}
				{selectedReport === 'ativos_departamento' && (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-[11px] border-collapse">
							<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
								<tr>
									<th className="py-2.5 px-3">Departamento</th>
									<th className="py-2.5 px-3 text-right">Total</th>
									<th className="py-2.5 px-3 text-right">Em Uso</th>
									<th className="py-2.5 px-3 text-right">Estoque</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border-subtle">
								{uniqueDepartments.map(dept => {
									const deptDevices = devices.filter(d => d.currentDepartment === dept);
									const inUse = deptDevices.filter(d => d.status === 'Em uso').length;
									const stock = deptDevices.filter(d => d.status === 'Disponível').length;
									return (
										<tr key={dept} className="hover:bg-surface-subtle transition-colors">
											<td className="py-2.5 px-3 font-medium text-text-primary">{dept}</td>
											<td className="py-2.5 px-3 text-right font-code tabular-nums text-text-primary">{deptDevices.length}</td>
											<td className="py-2.5 px-3 text-right font-code tabular-nums text-status-success-fg">{inUse}</td>
											<td className="py-2.5 px-3 text-right font-code tabular-nums text-text-muted">{stock}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				{/* 7. Movimentações por Período */}
				{selectedReport === 'movimentacoes_periodo' && (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-[11px] border-collapse">
							<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
								<tr>
									<th className="py-2.5 px-3">Código</th>
									<th className="py-2.5 px-3">Operação Conjunta</th>
									<th className="py-2.5 px-3">Data</th>
									<th className="py-2.5 px-3">Tipo</th>
									<th className="py-2.5 px-3">Aparelho</th>
									<th className="py-2.5 px-3">Linha</th>
									<th className="py-2.5 px-3">Origem</th>
									<th className="py-2.5 px-3">Destino</th>
									<th className="py-2.5 px-3">Motivo</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border-subtle">
								{movements.map(m => (
									<tr key={m.id} className="hover:bg-surface-subtle transition-colors">
										<td className="py-2.5 px-3 font-code font-bold text-text-primary">{m.code}</td>
										<td className="py-2.5 px-3 font-code text-text-muted">{m.batchOperationId || ''}</td>
										<td className="py-2.5 px-3 font-code text-text-muted">{formatDate(m.date)}</td>
										<td className="py-2.5 px-3 font-medium text-text-primary">{m.type}</td>
										<td className="py-2.5 px-3 font-code text-text-muted">{m.deviceTag || ''}</td>
										<td className="py-2.5 px-3 font-code text-text-muted">{m.phoneNumber || ''}</td>
										<td className="py-2.5 px-3 text-text-muted">{stockDisplayName(m.originCollaboratorName)}</td>
										<td className="py-2.5 px-3 text-text-muted">{stockDisplayName(m.destinationCollaboratorName)}</td>
										<td className="py-2.5 px-3 text-text-muted">{m.reason || ''}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{/* 8. Manutenção */}
				{selectedReport === 'manutencao' && (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-[11px] border-collapse">
							<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider">
								<tr>
									<th className="py-2.5 px-3">Tag</th>
									<th className="py-2.5 px-3">Marca / Modelo</th>
									<th className="py-2.5 px-3">IMEI 1</th>
									<th className="py-2.5 px-3">Condição</th>
									<th className="py-2.5 px-3">Departamento</th>
									<th className="py-2.5 px-3">Responsável</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border-subtle">
								{devices.filter(d => d.status === 'Em manutenção' || d.status === 'Aguardando avaliação').map(d => (
									<tr key={d.id} className="hover:bg-surface-subtle transition-colors">
										<td className="py-2.5 px-3 font-code font-bold text-text-primary">{d.assetTag}</td>
										<td className="py-2.5 px-3 font-medium text-text-primary">{d.model}</td>
										<td className="py-2.5 px-3 font-code text-text-muted">{formatImei(d.imei1)}</td>
										<td className="py-2.5 px-3"><StatusBadge status={d.condition} type="condition" size="sm" /></td>
										<td className="py-2.5 px-3 text-text-muted">{d.currentDepartment || '-'}</td>
										<td className="py-2.5 px-3 text-text-muted">{d.currentCollaboratorName || '-'}</td>
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