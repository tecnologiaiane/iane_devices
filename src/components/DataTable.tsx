import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface DataTableColumn<T> {
	/** Identificador estável da coluna. */
	key: string
	header: React.ReactNode
	/** Classes extras aplicadas ao <th>. */
	headerClassName?: string
	/** Classes extras aplicadas ao <td> (as padrão já entram: py-3 px-4). */
	cellClassName?: string
	render: (row: T, index: number) => React.ReactNode
}

interface DataTableProps<T> {
	columns: DataTableColumn<T>[]
	rows: T[]
	rowKey: (row: T) => string
	onRowClick?: (row: T) => void
	/** Conteúdo exibido quando não há linhas (fora do <table>, abaixo do cabeçalho). */
	empty?: React.ReactNode
	/** Texto acessível que descreve a tabela. */
	caption?: string
	className?: string
}

/**
 * Tabela padrão do design system IANE v3.6: card com borda hairline, cabeçalho
 * uppercase em surface-subtle e linhas com hover. Colunas e células são
 * fornecidas pela tela, preservando conteúdo e ações específicos de cada visão.
 */
export function DataTable<T>({
	columns,
	rows,
	rowKey,
	onRowClick,
	empty,
	caption,
	className,
}: DataTableProps<T>) {
	return (
		<div className={twMerge('radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden', className)}>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-xs border-collapse">
					{caption && <caption className="sr-only">{caption}</caption>}
					<thead className="bg-surface-subtle border-b border-border-subtle text-text-muted uppercase font-semibold tracking-wider text-[11px]">
						<tr>
							{columns.map((column) => (
								<th key={column.key} scope="col" className={twMerge('py-3 px-4', column.headerClassName)}>
									{column.header}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-border-subtle">
						{rows.map((row, index) => (
							<tr
								key={rowKey(row)}
								onClick={onRowClick ? () => onRowClick(row) : undefined}
								className={twMerge(
									'transition-colors',
									onRowClick && 'hover:bg-surface-subtle cursor-pointer',
								)}
							>
								{columns.map((column) => (
									<td key={column.key} className={twMerge('py-3 px-4', column.cellClassName)}>
										{column.render(row, index)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>

				{rows.length === 0 && empty}
			</div>
		</div>
	)
}
