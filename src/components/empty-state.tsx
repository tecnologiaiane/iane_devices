import { Inbox, TriangleAlert, type LucideIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps, ReactNode } from 'react';

export interface EmptyStateProps extends ComponentProps<'div'> {
	title: string;
	description?: string;
	icon?: LucideIcon;
	tone?: 'default' | 'error';
	action?: ReactNode;
}

export function EmptyState({
	title,
	description,
	icon,
	tone = 'default',
	action,
	className,
	...props
}: EmptyStateProps) {
	const Icon = icon ?? (tone === 'error' ? TriangleAlert : Inbox);

	return (
		<div
			data-slot="empty-state"
			className={twMerge('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}
			{...props}
		>
			<Icon
				className={twMerge('h-9 w-9', tone === 'error' ? 'text-danger-fg' : 'text-muted')}
				aria-hidden="true"
			/>
			<p className="text-sm font-semibold text-text">{title}</p>
			{description && <p className="max-w-sm text-xs text-muted">{description}</p>}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}
