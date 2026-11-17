import { ArrowRight, FileText } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'

export interface TimelineEventProps extends ComponentProps<'div'> {
	type: string
	code: string | null
	date: string
	origin: string
	destination: string
	documentCode: string | null
	reason: string | null
}

export function TimelineEvent({
	type,
	code,
	date,
	origin,
	destination,
	documentCode,
	reason,
	className,
	...props
}: TimelineEventProps) {
	return (
		<div data-slot="timeline-event" className={twMerge('relative pl-6', className)} {...props}>
			<div
				className="absolute left-0 top-3.5 h-3 w-3 rounded-full border-2 border-white bg-brand-blue-action shadow-sm"
				aria-hidden="true"
			/>

			<div className="space-y-1.5 radius-base border border-border-subtle bg-surface-subtle p-3">
				<div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<span className="text-xs font-bold text-text-primary">{type}</span>
						{code && <span className="font-code text-[10px] text-text-muted">{code}</span>}
					</div>
					<span className="font-code text-[11px] font-semibold text-text-muted">{date}</span>
				</div>

				<div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-text-muted">
					<span>De:</span>
					<span className="radius-base bg-surface-card px-1.5 py-0.5 font-bold text-text-primary">{origin}</span>
					<ArrowRight className="h-3 w-3 shrink-0 text-border-strong" aria-hidden="true" />
					<span>Para:</span>
					<span className="radius-base bg-surface-card px-1.5 py-0.5 font-bold text-text-primary">{destination}</span>
				</div>

				{reason && <p className="text-[11px] italic leading-relaxed text-text-muted">&ldquo;{reason}&rdquo;</p>}

				{documentCode && (
					<div className="flex items-center gap-1 border-t border-border-subtle pt-1.5">
						<FileText className="h-3 w-3 shrink-0 text-brand-blue-action" aria-hidden="true" />
						<span className="font-code text-[10px] font-semibold text-brand-blue-action">
							Documento vinculado: {documentCode}
						</span>
					</div>
				)}
			</div>
		</div>
	)
}
