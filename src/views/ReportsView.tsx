import React, { useState } from 'react';
import { dataService, stockDisplayName } from '../services/dataStorage';
import { formatDate, formatCurrency, formatImei, downloadCsv } from '../utils/formatters';
import { todayISO } from '../utils/dates';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/button';
import { DataTable, type DataTableColumn } from '../components/DataTable';
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
} from '../components/icons';

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
					<DataTable
						caption="Inventário geral de aparelhos"
						columns={[
							{
								key: 'assetTag',
								header: 'Tag',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code font-bold text-text-primary',
								render: (d: any) => d.assetTag,
							},
							{
								key: 'model',
								header: 'Marca / Modelo',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-medium text-text-primary',
								render: (d: any) => d.model,
							},
							{
								key: 'imei1',
								header: 'IMEI 1',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (d: any) => formatImei(d.imei1),
							},
							{
								key: 'serialNumber',
								header: 'S/N',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (d: any) => d.serialNumber,
							},
							{
								key: 'status',
								header: 'Status',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3',
								render: (d: any) => <StatusBadge status={d.status} type="device" size="sm" />,
							},
							{
								key: 'responsavel',
								header: 'Responsável',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3',
								render: (d: any) => d.currentCollaboratorName || <span className="text-text-muted italic font-body">Disponível</span>,
							},
							{
								key: 'linha',
								header: 'Linha',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code',
								render: (d: any) => d.associatedPhoneNumber || '-',
							},
							{
								key: 'setor',
								header: 'Setor',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3',
								render: (d: any) => d.currentDepartment || '-',
							},
							{
								key: 'purchaseValue',
								header: 'Valor Compra',
								headerClassName: 'py-2.5 px-3 text-right',
								cellClassName: 'py-2.5 px-3 text-right font-code tabular-nums',
								render: (d: any) => formatCurrency(d.purchaseValue),
							},
						]}
						rows={devices}
						rowKey={(d: any) => d.id}
						empty={<div className="p-4 text-center text-text-muted">Nenhum aparelho encontrado.</div>}
					/>
				)}

				{/* 2. Por Colaborador */}
				{selectedReport === 'por_colaborador' && (
					<DataTable
						caption="Aparelhos atribuídos por colaborador"
						columns={[
							{
								key: 'colaborador',
								header: 'Colaborador',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-medium text-text-primary',
								render: (d: any) => d.currentCollaboratorName || '',
							},
							{
								key: 'matricula',
								header: 'Matrícula',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (d: any) => {
									const col = collabs.find((c: any) => c.id === d.currentCollaboratorId);
									return col?.registrationNumber || '';
								},
							},
							{
								key: 'departamento',
								header: 'Departamento',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (d: any) => d.currentDepartment || '',
							},
							{
								key: 'cargo',
								header: 'Cargo',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (d: any) => {
									const col = collabs.find((c: any) => c.id === d.currentCollaboratorId);
									return col?.position || '';
								},
							},
							{
								key: 'assetTag',
								header: 'Aparelho Tag',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-primary',
								render: (d: any) => d.assetTag,
							},
							{
								key: 'modelo',
								header: 'Modelo',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (d: any) => d.model,
							},
							{
								key: 'imei',
								header: 'IMEI',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (d: any) => d.imei1,
							},
							{
								key: 'linha',
								header: 'Linha',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code',
								render: (d: any) => d.associatedPhoneNumber || '',
							},
						]}
						rows={devices.filter((d: any) => d.currentCollaboratorId)}
						rowKey={(d: any) => d.id}
						empty={<div className="p-4 text-center text-text-muted">Nenhum aparelho atribuído a colaboradores.</div>}
					/>
				)}

				{/* 3. Disponíveis */}
				{selectedReport === 'disponiveis' && (
					<DataTable
						caption="Aparelhos livres / disponíveis em estoque"
						columns={[
							{
								key: 'assetTag',
								header: 'Tag',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code font-bold text-text-primary',
								render: (d: any) => d.assetTag,
							},
							{
								key: 'modelo',
								header: 'Marca / Modelo',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-medium text-text-primary',
								render: (d: any) => d.model,
							},
							{
								key: 'imei1',
								header: 'IMEI 1',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (d: any) => formatImei(d.imei1),
							},
							{
								key: 'serialNumber',
								header: 'S/N',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (d: any) => d.serialNumber,
							},
							{
								key: 'condicao',
								header: 'Condição',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3',
								render: (d: any) => <StatusBadge status={d.condition} type="condition" size="sm" />,
							},
							{
								key: 'departamento',
								header: 'Departamento',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (d: any) => d.currentDepartment || '-',
							},
							{
								key: 'purchaseValue',
								header: 'Valor Compra',
								headerClassName: 'py-2.5 px-3 text-right',
								cellClassName: 'py-2.5 px-3 text-right font-code tabular-nums',
								render: (d: any) => formatCurrency(d.purchaseValue),
							},
						]}
						rows={devices.filter((d: any) => d.status === 'Disponível')}
						rowKey={(d: any) => d.id}
						empty={<div className="p-4 text-center text-text-muted">Nenhum aparelho disponível em estoque.</div>}
					/>
				)}

				{/* 4. Linhas por Status */}
				{selectedReport === 'linhas_status' && (
					<DataTable
						caption="Linhas telefônicas por operadora e status"
						columns={[
							{
								key: 'phoneNumber',
								header: 'Número',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-primary',
								render: (l: any) => l.phoneNumber,
							},
							{
								key: 'carrier',
								header: 'Operadora',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-medium text-text-primary',
								render: (l: any) => l.carrier,
							},
							{
								key: 'planName',
								header: 'Plano',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (l: any) => l.planName || '',
							},
							{
								key: 'monthlyCost',
								header: 'Custo Mensal',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code tabular-nums text-text-muted',
								render: (l: any) => (l.monthlyCost ? l.monthlyCost.toFixed(2) : ''),
							},
							{
								key: 'status',
								header: 'Status',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3',
								render: (l: any) => <StatusBadge status={l.status} type="line" size="sm" />,
							},
							{
								key: 'deviceTag',
								header: 'Aparelho Tag',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (l: any) => l.associatedDeviceTag || '',
							},
							{
								key: 'responsavel',
								header: 'Responsável',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (l: any) => l.currentCollaboratorName || '',
							},
							{
								key: 'departamento',
								header: 'Departamento',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (l: any) => l.department || '',
							},
						]}
						rows={lines}
						rowKey={(l: any) => l.id}
						empty={<div className="p-4 text-center text-text-muted">Nenhuma linha telefônica encontrada.</div>}
					/>
				)}

				{/* 5. Linhas Sem Aparelho */}
				{selectedReport === 'linhas_sem_aparelho' && (
					<DataTable
						caption="Linhas telefônicas órfãs (sem aparelho associado)"
						columns={[
							{
								key: 'phoneNumber',
								header: 'Número',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-primary',
								render: (l: any) => l.phoneNumber,
							},
							{
								key: 'carrier',
								header: 'Operadora',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-medium text-text-primary',
								render: (l: any) => l.carrier,
							},
							{
								key: 'planName',
								header: 'Plano',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (l: any) => l.planName || '',
							},
							{
								key: 'monthlyCost',
								header: 'Custo Mensal',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code tabular-nums text-text-muted',
								render: (l: any) => (l.monthlyCost ? l.monthlyCost.toFixed(2) : ''),
							},
							{
								key: 'status',
								header: 'Status',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3',
								render: (l: any) => <StatusBadge status={l.status} type="line" size="sm" />,
							},
							{
								key: 'departamento',
								header: 'Departamento',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (l: any) => l.department || '',
							},
						]}
						rows={lines.filter((l: any) => !l.associatedDeviceId)}
						rowKey={(l: any) => l.id}
						empty={<div className="p-4 text-center text-text-muted">Nenhuma linha órfã encontrada.</div>}
					/>
				)}

				{/* 6. Ativos por Departamento */}
				{selectedReport === 'ativos_departamento' && (
					<DataTable
						caption="Ativos por departamento"
						columns={[
							{
								key: 'dept',
								header: 'Departamento',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-medium text-text-primary',
								render: (dept: string) => dept,
							},
							{
								key: 'total',
								header: 'Total',
								headerClassName: 'py-2.5 px-3 text-right',
								cellClassName: 'py-2.5 px-3 text-right font-code tabular-nums text-text-primary',
								render: (_: string, idx: number) => {
									const dept = uniqueDepartments[idx];
									const deptDevices = devices.filter((d: any) => d.currentDepartment === dept);
									return deptDevices.length;
								},
							},
							{
								key: 'emUso',
								header: 'Em Uso',
								headerClassName: 'py-2.5 px-3 text-right',
								cellClassName: 'py-2.5 px-3 text-right font-code tabular-nums text-status-success-fg',
								render: (_: string, idx: number) => {
									const dept = uniqueDepartments[idx];
									const deptDevices = devices.filter((d: any) => d.currentDepartment === dept);
									return deptDevices.filter((d: any) => d.status === 'Em uso').length;
								},
							},
							{
								key: 'estoque',
								header: 'Estoque',
								headerClassName: 'py-2.5 px-3 text-right',
								cellClassName: 'py-2.5 px-3 text-right font-code tabular-nums text-text-muted',
								render: (_: string, idx: number) => {
									const dept = uniqueDepartments[idx];
									const deptDevices = devices.filter((d: any) => d.currentDepartment === dept);
									return deptDevices.filter((d: any) => d.status === 'Disponível').length;
								},
							},
						]}
						rows={uniqueDepartments}
						rowKey={(dept: string) => dept}
						empty={<div className="p-4 text-center text-text-muted">Nenhum departamento com aparelhos cadastrados.</div>}
					/>
				)}

				{/* 7. Movimentações por Período */}
				{selectedReport === 'movimentacoes_periodo' && (
					<DataTable
						caption="Movimentações por período"
						columns={[
							{
								key: 'code',
								header: 'Código',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code font-bold text-text-primary',
								render: (m: any) => m.code,
							},
							{
								key: 'batchOperationId',
								header: 'Operação Conjunta',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (m: any) => m.batchOperationId || '',
							},
							{
								key: 'date',
								header: 'Data',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (m: any) => formatDate(m.date),
							},
							{
								key: 'type',
								header: 'Tipo',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-medium text-text-primary',
								render: (m: any) => m.type,
							},
							{
								key: 'deviceTag',
								header: 'Aparelho',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (m: any) => m.deviceTag || '',
							},
							{
								key: 'phoneNumber',
								header: 'Linha',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (m: any) => m.phoneNumber || '',
							},
							{
								key: 'origin',
								header: 'Origem',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (m: any) => stockDisplayName(m.originCollaboratorName),
							},
							{
								key: 'destination',
								header: 'Destino',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (m: any) => stockDisplayName(m.destinationCollaboratorName),
							},
							{
								key: 'reason',
								header: 'Motivo',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (m: any) => m.reason || '',
							},
						]}
						rows={movements}
						rowKey={(m: any) => m.id}
						empty={<div className="p-4 text-center text-text-muted">Nenhuma movimentação encontrada no período.</div>}
					/>
				)}

				{/* 8. Manutenção */}
				{selectedReport === 'manutencao' && (
					<DataTable
						caption="Aparelhos em manutenção"
						columns={[
							{
								key: 'assetTag',
								header: 'Tag',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code font-bold text-text-primary',
								render: (d: any) => d.assetTag,
							},
							{
								key: 'model',
								header: 'Marca / Modelo',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-medium text-text-primary',
								render: (d: any) => d.model,
							},
							{
								key: 'imei1',
								header: 'IMEI 1',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 font-code text-text-muted',
								render: (d: any) => formatImei(d.imei1),
							},
							{
								key: 'condition',
								header: 'Condição',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3',
								render: (d: any) => <StatusBadge status={d.condition} type="condition" size="sm" />,
							},
							{
								key: 'department',
								header: 'Departamento',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (d: any) => d.currentDepartment || '-',
							},
							{
								key: 'collaborator',
								header: 'Responsável',
								headerClassName: 'py-2.5 px-3',
								cellClassName: 'py-2.5 px-3 text-text-muted',
								render: (d: any) => d.currentCollaboratorName || '-',
							},
						]}
						rows={devices.filter((d: any) => d.status === 'Em manutenção' || d.status === 'Aguardando avaliação')}
						rowKey={(d: any) => d.id}
						empty={<div className="p-4 text-center text-text-muted">Nenhum aparelho em manutenção.</div>}
					/>
				)}
			</div>
		</div>
	);
};