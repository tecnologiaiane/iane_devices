import { tv, type VariantProps } from 'tailwind-variants'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'

export const buttonVariants = tv({
	base: [
		'inline-flex cursor-pointer items-center justify-center font-medium rounded-lg border transition-colors',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
		'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
	],
	variants: {
		variant: {
			primary: 'border-iane-600 bg-iane-600 text-white hover:bg-iane-700',
			secondary: 'border-ink-200 bg-ink-100 text-ink-700 hover:bg-ink-100',
			ghost: 'border-transparent bg-transparent text-ink-500 hover:text-ink-900 hover:bg-ink-100',
			destructive: 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700',
		},
		size: {
			sm: 'h-6 px-2 gap-1.5 text-xs [&_svg]:size-3',
			md: 'h-7 px-3 gap-2 text-sm [&_svg]:size-3.5',
			lg: 'h-9 px-4 gap-2.5 text-base [&_svg]:size-4',
		},
	},
	defaultVariants: { variant: 'primary', size: 'md' },
})

export interface ButtonProps
	extends ComponentProps<'button'>,
		VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, disabled, children, ...props }: ButtonProps) {
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
