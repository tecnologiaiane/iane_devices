import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
	label: string;
	description?: string;
}

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
	return (
		<label
			data-slot="checkbox"
			htmlFor={id}
			className={twMerge('flex cursor-pointer items-start gap-2 text-sm text-text', className)}
		>
			<input
				id={id}
				type="checkbox"
				className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong text-accent accent-accent focus:ring-2 focus:ring-focus/40"
				{...props}
			/>
			<span className="min-w-0">
				<span className="block text-xs font-medium leading-snug">{label}</span>
				{description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
			</span>
		</label>
	);
}
