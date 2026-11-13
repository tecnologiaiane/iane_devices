import { tv, type VariantProps } from 'tailwind-variants';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';

export const badgeVariants = tv({
	base: 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border font-medium tracking-tight',
	variants: {
		variant: {
			default: 'border-line bg-subtle text-muted',
			primary: 'border-accent bg-accent text-on-accent',
			secondary: 'border-line bg-subtle text-text',
			outline: 'border-line-strong bg-transparent text-text',
			success: 'border-ok-bd bg-ok-bg text-ok-fg',
			warning: 'border-warn-bd bg-warn-bg text-warn-fg',
			info: 'border-info-bd bg-info-bg text-info-fg',
			danger: 'border-danger-bd bg-danger-bg text-danger-fg',
			destructive: 'border-danger-bd bg-danger-bg text-danger-fg',
		},
		size: {
			sm: 'px-2 py-0.5 text-xs',
			md: 'px-2.5 py-1 text-xs font-medium',
			lg: 'px-3 py-1.5 text-sm',
		},
	},
	defaultVariants: { variant: 'default', size: 'md' },
});

export interface BadgeProps
	extends ComponentProps<'span'>,
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, children, ...props }: BadgeProps) {
	return (
		<span
			data-slot="badge"
			data-variant={variant}
			data-size={size}
			className={twMerge(badgeVariants({ variant, size }), className)}
			{...props}
		>
			{children}
		</span>
	);
}
