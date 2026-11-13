import { tv, type VariantProps } from 'tailwind-variants'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'

export const buttonVariants = tv({
	base: [
		'inline-flex cursor-pointer items-center justify-center font-medium border transition-colors',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-base focus-visible:ring-offset-2',
		'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		'active:scale-95 active:transition-transform active:duration-150',
	],
	variants: {
		variant: {
			// Primary (Blue) — ação principal
			primary: 'border-transparent bg-brand-blue-action text-white hover:bg-brand-blue-action-hover',
			// Secondary (Outlined)
			secondary: 'border-border-subtle bg-surface-card text-text-primary hover:bg-surface-subtle hover:border-border-strong',
			// Brand Accent (Solar) — destaque focal, texto navy
			solar: 'border-transparent bg-brand-sun text-brand-navy-base font-semibold hover:bg-[#F5E230]',
			// Ghost/Tertiary
			ghost: 'border-transparent bg-transparent text-text-muted hover:bg-surface-subtle hover:text-text-primary',
			// Destructive
			destructive: 'border-transparent bg-status-danger-bg text-status-danger-fg hover:bg-status-danger-border',
		},
		size: {
			sm: 'rounded-base h-9 px-3 gap-1.5 text-xs [&_svg]:size-3.5',
			md: 'rounded-xl h-10 px-3.5 gap-2 text-sm [&_svg]:size-4',
			lg: 'rounded-xl h-11 px-4 gap-2.5 text-base [&_svg]:size-5',
		},
	},
	defaultVariants: { variant: 'primary', size: 'md' },
})

export interface ButtonProps
	extends ComponentProps<'button'>,
		VariantProps<typeof buttonVariants> {}

export function Button({
	className,
	variant,
	size,
	disabled,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			type="button"
			data-slot="button"
			data-disabled={disabled ? '' : undefined}
			className={twMerge(buttonVariants({ variant, size }), className)}
			disabled={disabled}
			{...props}
		>
			{children}
		</button>
	)
}
