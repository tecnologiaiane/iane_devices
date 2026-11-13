import { tv, type VariantProps } from 'tailwind-variants';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';

export const cardVariants = tv({
	base: 'rounded-lg border border-line bg-surface text-text',
	variants: {
		variant: {
			default: '',
			interactive: 'transition-colors hover:border-line-strong',
			subtle: 'bg-subtle',
			danger: 'border-danger-bd bg-danger-bg',
		},
		padding: {
			none: '',
			sm: 'p-3',
			md: 'p-4',
			lg: 'p-6',
		},
	},
	defaultVariants: { variant: 'default', padding: 'none' },
});

export interface CardProps
	extends ComponentProps<'div'>,
		VariantProps<typeof cardVariants> {}

export function Card({ className, variant, padding, ...props }: CardProps) {
	return (
		<div
			data-slot="card"
			className={twMerge(cardVariants({ variant, padding }), className)}
			{...props}
		/>
	);
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-header"
			className={twMerge('flex flex-col gap-1 border-b border-line px-4 py-3', className)}
			{...props}
		/>
	);
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
	return (
		<h3
			data-slot="card-title"
			className={twMerge('text-subtitle font-strong text-text', className)}
			{...props}
		/>
	);
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
	return (
		<p data-slot="card-description" className={twMerge('text-xs text-muted', className)} {...props} />
	);
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot="card-content" className={twMerge('p-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot="card-footer"
			className={twMerge('flex items-center justify-end gap-2 border-t border-line px-4 py-3', className)}
			{...props}
		/>
	);
}
