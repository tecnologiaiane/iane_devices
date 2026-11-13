import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';

export interface FieldProps extends ComponentProps<'div'> {
	id: string;
	label: string;
	hint?: string;
	error?: string;
	required?: boolean;
	labelClassName?: string;
}

export function Field({
	id,
	label,
	hint,
	error,
	required = false,
	className,
	labelClassName,
	children,
	...props
}: FieldProps) {
	return (
		<div data-slot="field" className={twMerge('space-y-1', className)} {...props}>
			<label
				htmlFor={id}
				className={twMerge('block text-xs font-semibold text-text', labelClassName)}
			>
				{label}
				{required && (
					<span className="ml-0.5 text-danger-fg" aria-hidden="true">
						*
					</span>
				)}
			</label>
			{children}
			{error ? (
				<p id={`${id}-error`} className="text-xs font-medium text-danger-fg" role="alert">
					{error}
				</p>
			) : hint ? (
				<p id={`${id}-hint`} className="text-xs text-muted">
					{hint}
				</p>
			) : null}
		</div>
	);
}

/** Liga o campo aos textos de ajuda/erro renderizados pelo Field. */
export function fieldDescribedBy(id: string, error?: string, hint?: string): string | undefined {
	if (error) return `${id}-error`;
	if (hint) return `${id}-hint`;
	return undefined;
}
