import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps, ReactNode } from 'react';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<
	AlertTone,
	{ container: string; icon: string; Icon: typeof Info; role: 'status' | 'alert' }
> = {
	info: {
		container: 'border-info-bd bg-info-bg text-info-fg',
		icon: 'text-info-fg',
		Icon: Info,
		role: 'status',
	},
	success: {
		container: 'border-ok-bd bg-ok-bg text-ok-fg',
		icon: 'text-ok-fg',
		Icon: CheckCircle2,
		role: 'status',
	},
	warning: {
		container: 'border-warn-bd bg-warn-bg text-warn-fg',
		icon: 'text-warn-fg',
		Icon: AlertTriangle,
		role: 'alert',
	},
	danger: {
		container: 'border-danger-bd bg-danger-bg text-danger-fg',
		icon: 'text-danger-fg',
		Icon: XCircle,
		role: 'alert',
	},
};

export interface AlertProps extends ComponentProps<'div'> {
	tone?: AlertTone;
	title?: string;
	icon?: ReactNode;
}

export function Alert({
	tone = 'info',
	title,
	icon,
	className,
	children,
	...props
}: AlertProps) {
	const styles = TONE[tone];
	const Icon = styles.Icon;

	return (
		<div
			data-slot="alert"
			data-tone={tone}
			role={styles.role}
			className={twMerge('flex items-start gap-2.5 rounded-lg border p-3 text-xs', styles.container, className)}
			{...props}
		>
			<span className={twMerge('mt-0.5 shrink-0', styles.icon)} aria-hidden="true">
				{icon ?? <Icon className="h-4 w-4" />}
			</span>
			<div className="min-w-0 flex-1">
				{title && <p className="font-semibold leading-snug">{title}</p>}
				{children && <div className={twMerge('leading-relaxed', title && 'mt-0.5')}>{children}</div>}
			</div>
		</div>
	);
}
