import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { Button } from './button'

export interface DeviceDetailFooterProps extends ComponentProps<'div'> {
	createdAt: string | null
	onClose: () => void
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
				'px-6 py-3 border-t border-border bg-surface/50 flex items-center justify-between gap-4',
				className
			)}
			{...props}
		>
			<div className="text-[11px] text-foreground-subtle flex items-center gap-1">
				Cadastrado em <span className="font-medium text-foreground">{createdAt ?? '-'}</span>
			</div>
			<Button variant="ghost" size="sm" onClick={onClose}>
				Fechar
			</Button>
		</div>
	)
}
