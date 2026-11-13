import { tv, type VariantProps } from 'tailwind-variants';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';

export const buttonVariants = tv({
	base: [
		'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-semibold transition-colors',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
		'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
	],
	variants: {
		variant: {
			primary: 'border-accent bg-accent text-on-accent hover:bg-accent/90',
			secondary: 'border-line-strong bg-subtle text-text hover:bg-line',
			outline: 'border-line-strong bg-transparent text-text hover:bg-subtle',
			ghost: 'border-transparent bg-transparent text-muted hover:bg-subtle hover:text-text',
			destructive: 'border-danger-fg bg-danger-fg text-danger-bg hover:opacity-90',
			brand: 'border-brand-sun bg-brand-sun text-brand-navy hover:opacity-90',
		},
		size: {
			sm: 'h-8 px-2.5 text-xs [&_svg]:size-3.5',
			md: 'h-10 px-4 text-sm [&_svg]:size-4',
			lg: 'h-11 px-5 text-sm [&_svg]:size-4',
			icon: 'h-9 w-9 p-0 [&_svg]:size-4',
		},
	},
	defaultVariants: { variant: 'primary', size: 'md' },
});

export interface ButtonProps
	extends ComponentProps<'button'>,
		VariantProps<typeof buttonVariants> {
	loading?: boolean;
}

export function Button({
	className,
	variant,
	size,
	disabled,
	loading = false,
	children,
	type = 'button',
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			data-slot="button"
			data-variant={variant}
			data-size={size}
			aria-busy={loading || undefined}
			className={twMerge(buttonVariants({ variant, size }), className)}
			disabled={disabled || loading}
			{...props}
		>
			{loading && <Loader2 className="animate-spin" aria-hidden="true" />}
			{children}
		</button>
	);
}
