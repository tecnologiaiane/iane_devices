import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';

export const inputClass = [
	'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-text',
	'placeholder:text-muted transition-colors',
	'hover:border-muted focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus/40',
	'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted',
	'aria-[invalid=true]:border-danger-fg aria-[invalid=true]:ring-danger-fg/30',
].join(' ');

export interface InputProps extends ComponentProps<'input'> {
	invalid?: boolean;
}

export function Input({ className, invalid, type = 'text', ...props }: InputProps) {
	return (
		<input
			data-slot="input"
			type={type}
			aria-invalid={invalid || undefined}
			className={twMerge(inputClass, className)}
			{...props}
		/>
	);
}
