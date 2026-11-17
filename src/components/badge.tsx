import { Slot } from '@radix-ui/react-slot'
import { tv, type VariantProps } from 'tailwind-variants'
import type { ComponentProps } from 'react'
import { cn } from '../lib/utils'

export const badgeVariants = tv({
	base: 'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
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
			md: 'h-6 px-2.5 py-0.5 text-[11px] font-semibold',
		},
	},
	defaultVariants: { variant: 'default', size: 'md' },
})

export interface BadgeProps
	extends ComponentProps<'span'>,
		VariantProps<typeof badgeVariants> {
	asChild?: boolean
	showDot?: boolean
}

export function Badge({
	className,
	variant,
	size,
	asChild = false,
	showDot = false,
	children,
	...props
}: BadgeProps) {
	const Comp = asChild ? Slot : 'span'

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			data-size={size}
			className={cn(badgeVariants({ variant, size }), className)}
			{...props}
		>
			{showDot && (
				<span
					className="shrink-0 w-1.5 h-1.5 rounded-full bg-current"
					aria-hidden="true"
				/>
			)}
			{children}
		</Comp>
	)
}
