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
				'flex shrink-0 items-start gap-3 border-b border-ink-200 bg-ink-50/60 px-4 py-4 sm:px-6',
				className
			)}
			{...props}
		>
			<div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-iane-600 text-white shadow-sm sm:flex">
				<Smartphone className="h-5 w-5" aria-hidden="true" />
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<h2 id={titleId} className="font-mono text-sm font-bold text-ink-900">
						{tag}
					</h2>
					<StatusBadge status={status} type="device" size="sm" />
				</div>

				<p className="mt-0.5 break-words text-sm font-semibold text-ink-900">{model || 'Modelo não informado'}</p>

				<p className="mt-1 break-words text-[11px] leading-relaxed text-ink-500">
					Nº de série: <span className="font-mono text-ink-900">{serialNumber || '—'}</span>
					<span className="mx-1.5 text-ink-300" aria-hidden="true">
						|
					</span>
					Custódia: <span className="font-semibold text-ink-900">{custodian || '—'}</span>
				</p>
			</div>

			<button
				type="button"
				data-autofocus
				onClick={onClose}
				aria-label="Fechar detalhes do dispositivo"
				className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<X className="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	)
}
