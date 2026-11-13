import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { TimelineEvent } from './timeline-event'
import { formatDate } from '../utils/formatters'
import type { Movement } from '../types'

export interface DeviceTimelineProps extends ComponentProps<'div'> {
	events: Movement[]
}

export function DeviceTimeline({ events, className, ...props }: DeviceTimelineProps) {
	return (
		<div data-slot="device-timeline" className={twMerge('space-y-4', className)} {...props}>
			<div className="rounded-lg border border-iane-200 bg-iane-50 p-3 text-xs text-iane-800">
				<p className="font-semibold">Histórico do dispositivo</p>
				<p className="mt-0.5 text-[11px] leading-relaxed">
					Cada período de utilização por colaborador e cada passagem pelo Estoque, na ordem mais
					recente.
				</p>
			</div>

			{events.length === 0 ? (
				<p className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-xs text-ink-500">
					Nenhuma movimentação registrada para este aparelho.
				</p>
			) : (
				<div className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-0.5 before:bg-ink-200 before:content-['']">
					{events.map((event) => (
						<TimelineEvent
							key={event.id}
							type={event.type}
							code={event.code || null}
							date={formatDate(event.date)}
							origin={event.originCollaboratorName || 'Estoque'}
							destination={event.destinationCollaboratorName || 'Estoque'}
							documentCode={event.documentCode || null}
							reason={event.reason || event.observations || null}
						/>
					))}
				</div>
			)}
		</div>
	)
}
