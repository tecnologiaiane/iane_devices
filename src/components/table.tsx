import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';

export function Table({ className, ...props }: ComponentProps<'table'>) {
	return (
		<div className="w-full overflow-x-auto">
			<table data-slot="table" className={twMerge('ds-table', className)} {...props} />
		</div>
	);
}

export function TableHead({ className, ...props }: ComponentProps<'thead'>) {
	return <thead data-slot="table-head" className={className} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
	return <tbody data-slot="table-body" className={className} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
	return <tr data-slot="table-row" className={className} {...props} />;
}

export function TableHeaderCell({ className, ...props }: ComponentProps<'th'>) {
	return <th data-slot="table-header-cell" scope="col" className={className} {...props} />;
}

export interface TableCellProps extends ComponentProps<'td'> {
	/** Rótulo exibido no modo cartão em telas estreitas. */
	label?: string;
}

export function TableCell({ className, label, ...props }: TableCellProps) {
	return <td data-slot="table-cell" data-label={label} className={className} {...props} />;
}
