import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { Button } from './button'
import { formatDate } from '../utils/formatters'

export interface DeviceDetailFooterProps extends ComponentProps<'div'> {
	createdAt: string | null
	onClose: () => void
}

export function DeviceDetailFooter({ createdAt, onClose, className, ...props }: DeviceDetailFooterProps) {
	return (
		<div
			data-slot="device-detail-footer"
			className={twMerge(
				'flex shrink-0 items-center justify-between gap-3 border-t border-ink-200 bg-ink-50/60 px-4 py-3 sm:px-6',
				className
			)}
			{...props}
		>
			<p className="min-w-0 truncate text-[11px] text-ink-500">
				Cadastrado em <span className="font-medium text-ink-900">{formatDate(createdAt ?? undefined)}</span>
			</p>
			<Button variant="ghost" size="lg" onClick={onClose} className="shrink-0">
				Fechar
			</Button>
		</div>
	)
}
