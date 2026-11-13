import { twMerge } from 'tailwind-merge';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';

export const selectClass = [
	'w-full appearance-none rounded-md border border-line-strong bg-surface px-3 py-2 pr-8 text-sm text-text',
	'transition-colors hover:border-muted focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus/40',
	'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted',
	'aria-[invalid=true]:border-danger-fg',
].join(' ');

export interface SelectProps extends ComponentProps<'select'> {
	invalid?: boolean;
}

export function Select({ className, invalid, children, ...props }: SelectProps) {
	return (
		<div className="relative" data-slot="select-wrapper">
			<select
				data-slot="select"
				aria-invalid={invalid || undefined}
				className={twMerge(selectClass, className)}
				{...props}
			>
				{children}
			</select>
			<ChevronDown
				className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
				aria-hidden="true"
			/>
		</div>
	);
}
