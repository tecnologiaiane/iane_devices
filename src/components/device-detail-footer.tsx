import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';
import { Button } from './button';

export interface DeviceDetailFooterProps extends ComponentProps<'div'> {
	createdAt: string | null;
	onClose: () => void;
}

export function DeviceDetailFooter({
	createdAt,
	onClose,
	className,
	...props
}: DeviceDetailFooterProps) {
	return (
		<div
			data-slot="device-detail-footer"
			className={twMerge(
				'flex items-center justify-between gap-4 border-t border-line bg-subtle/60 px-5 py-3',
				className
			)}
			{...props}
		>
			<p className="text-[11px] text-muted">
				Cadastrado em <span className="font-medium text-text">{createdAt ?? '—'}</span>
			</p>
			<Button variant="ghost" size="sm" onClick={onClose}>
				Fechar
			</Button>
		</div>
	);
}
