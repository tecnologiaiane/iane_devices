import { Info } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { TimelineEvent } from './timeline-event'
import { formatDate } from '../utils/formatters'
import type { Movement } from '../types'

export interface DeviceTimelineProps extends ComponentProps<'div'> {
	events: Movement[]
}

const HISTORY_HELP =
	'Cada período de utilização por colaborador e cada passagem pelo Estoque, na ordem mais recente.'

export function DeviceTimeline({ events, className, ...props }: DeviceTimelineProps) {
	return (
		<div data-slot="device-timeline" className={twMerge('space-y-3', className)} {...props}>
			<div className="flex justify-end">
				<span
					role="img"
					tabIndex={0}
					aria-label={HISTORY_HELP}
					title={HISTORY_HELP}
					className="inline-flex h-6 w-6 cursor-help items-center justify-center rounded-full border border-border-subtle bg-surface-card text-text-muted transition-colors hover:border-border-strong hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-base"
				>
					<Info className="h-3.5 w-3.5" aria-hidden="true" />
				</span>
			</div>

			{events.length === 0 ? (
				<p className="radius-base border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">
					Nenhuma movimentação registrada para este aparelho.
				</p>
			) : (
				<div className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-0.5 before:bg-border-subtle before:content-['']">
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
