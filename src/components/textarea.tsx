import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';

export const textareaClass = [
	'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-text',
	'placeholder:text-muted transition-colors hover:border-muted',
	'focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus/40',
	'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted',
	'aria-[invalid=true]:border-danger-fg',
].join(' ');

export interface TextareaProps extends ComponentProps<'textarea'> {
	invalid?: boolean;
}

export function Textarea({ className, invalid, rows = 3, ...props }: TextareaProps) {
	return (
		<textarea
			data-slot="textarea"
			rows={rows}
			aria-invalid={invalid || undefined}
			className={twMerge(textareaClass, className)}
			{...props}
		/>
	);
}
