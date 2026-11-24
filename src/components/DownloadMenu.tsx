import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import type { DataTableColumn } from './DataTable';
import { downloadCsv } from '../utils/formatters';
import { todayISO } from '../utils/dates';
import { cn } from '../lib/utils';

type ExportFormat = 'csv' | 'xlsx';

interface DownloadMenuProps<T> {
	/** Nome base do arquivo, sem extensão e sem data (ex.: "dispositivos"). */
	fileName: string;
	/** Registros já filtrados pela tela, na ordem em que devem ser exportados. */
	data: T[];
	/** Mesmas colunas usadas pela DataTable da tela; a coluna de ações é ignorada. */
	columns: DataTableColumn<T>[];
}

function nodeToText(node: React.ReactNode): string {
	if (node === null || node === undefined || typeof node === 'boolean') return '';
	if (typeof node === 'string' || typeof node === 'number') return String(node);
	if (Array.isArray(node)) return node.map(nodeToText).filter(Boolean).join(' ');
	if (React.isValidElement(node)) {
		return nodeToText((node.props as { children?: React.ReactNode }).children);
	}
	return '';
}

function cellText(value: React.ReactNode): string {
	return nodeToText(value).replace(/\s+/g, ' ').trim();
}

/**
 * Exporta exatamente o conteúdo visível das colunas da tabela (sem a coluna
 * de ações). Como o texto vem do próprio `render` usado pela DataTable,
 * máscaras de LGPD aplicadas na tela são preservadas no arquivo.
 */
function buildExportRows<T>(data: T[], columns: DataTableColumn<T>[]): (string | number)[][] {
	const exportColumns = columns.filter((column) => !['actions', 'action', 'acoes'].includes(column.key));
	const headers = exportColumns.map((column) => cellText(column.header));
	const rows = data.map((row, index) =>
		exportColumns.map((column) => cellText(column.render(row, index)))
	);
	return [headers, ...rows];
}

/** Botão reutilizável de exportação CSV/Excel das telas de listagem. */
export function DownloadMenu<T>({ fileName, data, columns }: DownloadMenuProps<T>) {
	const [isOpen, setIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsOpen(false);
		};
		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [isOpen]);

	const handleExport = (format: ExportFormat) => {
		const rows = buildExportRows(data, columns);
		const baseName = `${fileName}_${todayISO()}`;

		if (format === 'csv') {
			downloadCsv(`${baseName}.csv`, rows);
		} else {
			const worksheet = XLSX.utils.aoa_to_sheet(rows);
			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
			XLSX.writeFile(workbook, `${baseName}.xlsx`);
		}

		setIsOpen(false);
	};

	return (
		<div className="relative shrink-0" ref={menuRef}>
			<button
				type="button"
				onClick={() => setIsOpen((open) => !open)}
				aria-haspopup="menu"
				aria-expanded={isOpen}
				className="inline-flex items-center gap-1.5 radius-base border border-border-subtle bg-surface-card px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-subtle focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 transition-colors"
			>
				<Download className="w-3.5 h-3.5" />
				<span>Download</span>
				<ChevronDown className={cn('w-3 h-3 text-text-muted transition-transform', isOpen && 'rotate-180')} />
			</button>

			{isOpen && (
				<div role="menu" className="absolute right-0 z-50 mt-1 w-44 overflow-hidden radius-lg border border-border-subtle bg-surface-card py-1 shadow-lg">
					<button
						type="button"
						role="menuitem"
						onClick={() => handleExport('csv')}
						className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-primary hover:bg-surface-subtle transition-colors"
					>
						<FileText className="w-3.5 h-3.5 text-brand-blue-action" />
						Formato CSV
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => handleExport('xlsx')}
						className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-primary hover:bg-surface-subtle transition-colors"
					>
						<FileSpreadsheet className="w-3.5 h-3.5 text-brand-blue-action" />
						Formato Excel
					</button>
				</div>
			)}
		</div>
	);
}
