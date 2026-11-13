import { tv, type VariantProps } from 'tailwind-variants'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'

export const badgeVariants = tv({
	base: 'inline-flex items-center gap-2 rounded-md border font-medium tracking-tight whitespace-nowrap',
	variants: {
		variant: {
			default: 'border-ink-200 bg-ink-50 text-ink-500',
			primary: 'border-iane-600 bg-iane-600 text-white',
			secondary: 'border-ink-200 bg-ink-100 text-ink-700',
			destructive: 'border-rose-600 bg-rose-600 text-white',
			success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
			warning: 'border-sun-300 bg-sun-50 text-gold-700',
			info: 'border-iane-200 bg-iane-50 text-iane-800',
		},
		size: {
			sm: 'px-2 py-0.5 text-xs',
			md: 'px-2.5 py-1 text-xs font-medium',
			lg: 'px-3 py-1.5 text-sm',
		},
	},
	defaultVariants: { variant: 'default', size: 'md' },
})

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
	)
}
