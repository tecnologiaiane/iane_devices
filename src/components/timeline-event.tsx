import { ArrowRight, FileText } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';

export interface TimelineEventProps extends ComponentProps<'li'> {
	type: string;
	code: string | null;
	date: string;
	origin: string;
	destination: string;
	documentCode: string | null;
	reason: string | null;
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
		<li
			data-slot="timeline-event"
			className={twMerge('relative pl-7', className)}
			{...props}
		>
			<span
				className="absolute -left-1.5 top-3 h-3 w-3 rounded-full border-2 border-surface bg-accent shadow-xs"
				aria-hidden="true"
			/>
			<div className="space-y-1.5 rounded-lg border border-line bg-surface p-3">
				<div className="flex flex-wrap items-center justify-between gap-1">
					<div className="flex min-w-0 items-center gap-2">
						<span className="text-xs font-semibold text-text">{type}</span>
						{code && (
							<span className="font-mono text-[10px] text-muted">({code})</span>
						)}
					</div>
					<time className="font-mono text-[11px] font-semibold tabular-nums text-muted">
						{date}
					</time>
				</div>

				<div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
					<span>De:</span>
					<span className="rounded bg-subtle px-1.5 py-0.5 font-semibold text-text">{origin}</span>
					<ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
					<span>Para:</span>
					<span className="rounded bg-subtle px-1.5 py-0.5 font-semibold text-text">
						{destination}
					</span>
				</div>

				{reason && <p className="text-[11px] italic text-muted">“{reason}”</p>}

				{documentCode && (
					<div className="flex items-center gap-1 pt-0.5">
						<FileText className="h-3 w-3 text-accent" aria-hidden="true" />
						<span className="font-mono text-[10px] font-semibold text-accent">
							Documento vinculado: {documentCode}
						</span>
					</div>
				)}
			</div>
		</li>
	);
}
