import { Slot } from '@radix-ui/react-slot'
import { tv, type VariantProps } from 'tailwind-variants'
import type { ComponentProps } from 'react'
import { cn } from '../lib/utils'

export const buttonVariants = tv({
	base: [
		'inline-flex cursor-pointer items-center justify-center font-medium border transition-colors',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-action/30 focus-visible:ring-offset-1',
		'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		'active:scale-95 active:transition-transform active:duration-150',
	],
	variants: {
		variant: {
			// Primary (Blue) — ação principal
			primary: 'border-transparent bg-brand-blue-action text-white shadow-xs hover:bg-brand-blue-action-hover',
			// Secondary (Outlined)
			secondary: 'border-border-subtle bg-surface-card text-text-primary hover:bg-surface-subtle hover:border-border-strong',
			// Brand Accent (Solar) — destaque focal, texto navy
			solar: 'border-transparent bg-brand-sun text-brand-navy-base font-semibold hover:bg-brand-sun-hover',
			// Ghost/Tertiary
			ghost: 'border-transparent bg-transparent text-text-muted hover:bg-surface-subtle hover:text-text-primary',
			// Destructive
			destructive: 'border-transparent bg-status-danger-bg text-status-danger-fg hover:bg-status-danger-border',
		},
		size: {
			sm: 'rounded-base h-8 px-2.5 gap-1.5 text-xs [&_svg]:size-3.5',
			md: 'rounded-base h-9 px-3 gap-2 text-[13px] [&_svg]:size-4',
			lg: 'rounded-base h-10 px-3.5 gap-2 text-sm [&_svg]:size-4',
		},
	},
	defaultVariants: { variant: 'primary', size: 'md' },
})

export interface ButtonProps
	extends ComponentProps<'button'>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

export function Button({
	className,
	variant,
	size,
	disabled,
	asChild = false,
	type = 'button',
	children,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot : 'button'
	const buttonOnlyProps = asChild ? {} : { type, disabled }

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			data-disabled={disabled ? '' : undefined}
			className={cn(buttonVariants({ variant, size }), className)}
			{...buttonOnlyProps}
			{...props}
		>
			{children}
		</Comp>
	)
}
