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
		<div
			data-slot="timeline-event"
			className={twMerge('relative pl-6 mb-4 last:mb-0', className)}
			{...props}
		>
			<div className="absolute -left-3 top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm bg-emerald-500" aria-hidden="true" />
			<div className="p-3 bg-ink-50 border border-ink-200 rounded-lg space-y-1">
				<div className="flex items-center justify-between flex-wrap gap-1">
					<div className="flex items-center gap-2">
						<span className="font-bold text-ink-900">{type}</span>
						{code && (
							<span className="text-[10px] font-mono text-ink-500">
								({code})
							</span>
						)}
					</div>
					<span className="font-mono text-ink-500 text-[11px] font-semibold">
						{date}
					</span>
				</div>
				<div className="text-[11px] text-ink-500 flex items-center gap-1.5 py-0.5 font-medium">
					<span className="text-ink-500">De:</span>
					<span className="px-1.5 py-0.5 rounded bg-ink-100 text-ink-900 font-bold">
						{origin}
					</span>
					<ArrowRight className="w-3 h-3 text-ink-500" />
					<span className="text-ink-500">Para:</span>
					<span className="px-1.5 py-0.5 rounded bg-ink-50 text-ink-900 font-bold">
						{destination}
					</span>
				</div>
				{reason && (
					<p className="text-[11px] text-ink-500 italic">"{reason}"</p>
				)}
				{documentCode && (
					<div className="pt-1 flex items-center gap-1">
						<FileText className="w-3 h-3 text-iane-600" />
						<span className="text-[10px] font-mono font-semibold text-iane-600">
							Documento Vinculado: {documentCode}
						</span>
					</div>
				)}
			</div>
		</div>
	)
}
