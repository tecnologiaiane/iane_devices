import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { TimelineEvent } from './timeline-event'

export interface DeviceTimelineProps extends ComponentProps<'div'> {}

export function DeviceTimeline({ className, ...props }: DeviceTimelineProps) {
	const events = [
		{
			type: 'Entrega',
			code: 'MOV-2026-005',
			date: '01/01/2026',
			origin: 'Estoque',
			destination: 'Ricardo Luis Barbosa de Lima',
			documentCode: 'MOV-2026-005-PDF',
			reason: 'Carga inicial',
		},
	]

	return (
		<div
			data-slot="device-timeline"
			className={twMerge('space-y-4', className)}
			{...props}
		>
			<div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary-800">
				<p className="font-semibold mb-0.5">Histórico do Dispositivo:</p>
				<p className="text-[11px] leading-relaxed">
					Apresenta formalmente cada período de utilização por colaborador e a devolução e conferência
					intermediária no Estoque.
				</p>
			</div>

			<div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
				{events.map((evt, idx) => (
					<TimelineEvent key={evt.code ?? idx} {...evt} />
				))}
				{events.length === 0 && (
					<p className="text-foreground-subtle text-center py-4">Sem movimentações registradas.</p>
				)}
			</div>
		</div>
	)
}
