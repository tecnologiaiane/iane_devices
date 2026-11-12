import { X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { Badge } from './badge'

export interface DeviceDetailHeaderProps extends ComponentProps<'div'> {
	tag: string
	model: string
	status: string
	serialNumber: string
	custodian: string
	onClose: () => void
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
				'flex items-center gap-3 p-5 border-b border-border bg-surface/50',
				className
			)}
			{...props}
		>
			<div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
				<span className="font-mono font-bold text-[11px]">{tag.split('-')[0]}</span>
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-mono font-bold text-foreground text-sm">{tag}</span>
					<span className="font-semibold text-foreground">{model}</span>
				</div>
				<div className="flex items-center gap-2 mt-1">
					<Badge variant="info" size="sm">
						<span className="w-1.5 h-1.5 rounded-full bg-iane-600 shrink-0" aria-hidden="true" />
						{status}
					</Badge>
				</div>
				<p className="text-xs text-foreground-subtle mt-1">
					Número de Série: <span className="font-mono text-foreground">{serialNumber}</span> &bull;
					Custódia: <span className="font-semibold text-foreground">{custodian}</span>
				</p>
			</div>
			<button
				data-slot="close-button"
				onClick={onClose}
				className={twMerge(
					'flex items-center justify-center w-8 h-8 rounded-md text-foreground-subtle hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
				)}
				aria-label="Fechar"
			>
				<X className="w-4 h-4" />
			</button>
		</div>
	)
}
