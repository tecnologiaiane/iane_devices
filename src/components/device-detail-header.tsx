import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';
import { StatusBadge } from './StatusBadge';

export interface DeviceDetailHeaderProps extends ComponentProps<'div'> {
	tag: string;
	model: string;
	status: string;
	serialNumber: string;
	custodian: string;
	onClose: () => void;
}

export function DeviceDetailHeader({
	tag,
	model,
	status,
	serialNumber,
	custodian,
	onClose,
	className,
	...props
}: DeviceDetailHeaderProps) {
	return (
		<div
			data-slot="device-detail-header"
			className={twMerge(
				'flex items-start gap-3 border-b border-line bg-subtle/60 p-5',
				className
			)}
			{...props}
		>
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent shadow-xs">
				<span className="font-mono text-[11px] font-bold">{tag.split('-')[0]}</span>
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-baseline gap-2">
					<span className="font-mono text-sm font-bold text-text">{tag}</span>
					<span className="text-sm font-semibold text-text">{model}</span>
				</div>
				<div className="mt-1">
					<StatusBadge status={status} type="device" />
				</div>
				<p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
					<span>
						Número de série:{' '}
						<span className="font-mono font-medium text-text">{serialNumber || '—'}</span>
					</span>
					<span aria-hidden="true">·</span>
					<span>
						Custódia: <span className="font-semibold text-text">{custodian}</span>
					</span>
				</p>
			</div>

			<button
				type="button"
				data-slot="close-button"
				onClick={onClose}
				className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
				aria-label="Fechar"
			>
				<X className="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	);
}
