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
				className="absolute left-0 top-3.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm"
				aria-hidden="true"
			/>

			<div className="space-y-1.5 rounded-lg border border-ink-200 bg-ink-50 p-3">
				<div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<span className="text-xs font-bold text-ink-900">{type}</span>
						{code && <span className="font-mono text-[10px] text-ink-500">{code}</span>}
					</div>
					<span className="font-mono text-[11px] font-semibold text-ink-500">{date}</span>
				</div>

				<div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-ink-500">
					<span>De:</span>
					<span className="rounded bg-ink-100 px-1.5 py-0.5 font-bold text-ink-900">{origin}</span>
					<ArrowRight className="h-3 w-3 shrink-0 text-ink-400" aria-hidden="true" />
					<span>Para:</span>
					<span className="rounded bg-white px-1.5 py-0.5 font-bold text-ink-900">{destination}</span>
				</div>

				{reason && <p className="text-[11px] italic leading-relaxed text-ink-500">&ldquo;{reason}&rdquo;</p>}

				{documentCode && (
					<div className="flex items-center gap-1 border-t border-ink-200 pt-1.5">
						<FileText className="h-3 w-3 shrink-0 text-iane-600" aria-hidden="true" />
						<span className="font-mono text-[10px] font-semibold text-iane-700">
							Documento vinculado: {documentCode}
						</span>
					</div>
				)}
			</div>
		</div>
	)
}
