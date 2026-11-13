import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';
import { History } from 'lucide-react';
import { TimelineEvent, type TimelineEventProps } from './timeline-event';
import { EmptyState } from './empty-state';

export interface TimelineEventData
	extends Pick<
		TimelineEventProps,
		'type' | 'code' | 'date' | 'origin' | 'destination' | 'documentCode' | 'reason'
	> {}

export interface DeviceTimelineProps extends ComponentProps<'div'> {
	events?: TimelineEventData[];
}

export function DeviceTimeline({ events = [], className, ...props }: DeviceTimelineProps) {
	return (
		<div data-slot="device-timeline" className={twMerge('space-y-3', className)} {...props}>
			<div className="rounded-lg border border-info-bd bg-info-bg p-3 text-xs text-info-fg">
				<p className="mb-0.5 font-semibold">Histórico do dispositivo</p>
				<p className="text-[11px] leading-relaxed">
					Cada período de utilização por colaborador, devolução e conferência intermediária no
					estoque.
				</p>
			</div>

			{events.length > 0 ? (
				<ol className="relative space-y-3 before:absolute before:bottom-3 before:left-0 before:top-3 before:w-px before:bg-line">
					{events.map((event, index) => (
						<TimelineEvent key={`${event.code ?? event.type}-${index}`} {...event} />
					))}
				</ol>
			) : (
				<EmptyState
					icon={History}
					title="Nenhuma movimentação registrada"
					description="As passagens por estoque e as entregas aparecem aqui quando ocorrerem."
				/>
			)}
		</div>
	);
}
