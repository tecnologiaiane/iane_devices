import { Smartphone, X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { StatusBadge } from './StatusBadge'

export interface DeviceDetailHeaderProps extends ComponentProps<'div'> {
	titleId: string
	tag: string
	model: string
	status: string
	serialNumber: string
	custodian: string
	onClose: () => void
}

export function DeviceDetailHeader({
	titleId,
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
				'flex shrink-0 items-start gap-3 border-b border-border-subtle bg-surface-subtle px-4 py-4 sm:px-6',
				className
			)}
			{...props}
		>
			<div className="hidden h-10 w-10 shrink-0 items-center justify-center radius-base bg-brand-blue-action text-white shadow-sm sm:flex">
				<Smartphone className="h-5 w-5" aria-hidden="true" />
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<h2 id={titleId} className="font-code text-xs font-semibold uppercase tracking-wider text-text-primary">
						{tag}
					</h2>
					<StatusBadge status={status} type="device" size="sm" />
				</div>

				<p className="mt-0.5 break-words text-sm font-semibold text-text-primary">{model || 'Modelo não informado'}</p>

				<p className="mt-1 break-words text-[11px] leading-relaxed text-text-muted">
					Nº de série: <span className="font-code text-text-primary">{serialNumber || '—'}</span>
					<span className="mx-1.5 text-border-strong" aria-hidden="true">
						|
					</span>
					Custódia: <span className="font-semibold text-text-primary">{custodian || '—'}</span>
				</p>
			</div>

			<button
				type="button"
				data-autofocus
				onClick={onClose}
				aria-label="Fechar detalhes do dispositivo"
				className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center radius-base text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-base"
			>
				<X className="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	)
}
