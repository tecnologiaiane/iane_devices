import { tv, type VariantProps } from 'tailwind-variants'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'

export const badgeVariants = tv({
	base: 'inline-flex items-center gap-1.5 rounded-full border font-medium tracking-tight whitespace-nowrap',
	variants: {
		variant: {
			default: 'border-border-subtle bg-surface-subtle text-text-muted',
			success: 'border-status-success-border bg-status-success-bg text-status-success-fg',
			warning: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
			danger: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg',
			info: 'border-status-info-border bg-status-info-bg text-status-info-fg',
		},
		size: {
			sm: 'h-6 px-2 py-0.5 text-[11px] font-semibold',
			md: 'h-7 px-2.5 py-0.5 text-xs font-semibold',
		},
	},
	defaultVariants: { variant: 'default', size: 'md' },
})

export interface BadgeProps
	extends ComponentProps<'span'>,
		VariantProps<typeof badgeVariants> {}

export function Badge({
	className,
	variant,
	size,
	children,
	showDot = false,
	...props
}: BadgeProps & { showDot?: boolean }) {
	return (
		<span
			data-slot="badge"
			data-variant={variant}
			data-size={size}
			className={twMerge(badgeVariants({ variant, size }), className)}
			{...props}
		>
			{showDot && (
				<span
					className="shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-60"
					aria-hidden="true"
				/>
			)}
			{children}
		</span>
	)
}
