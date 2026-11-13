import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';

export interface SwitchProps extends Omit<ComponentProps<'button'>, 'onChange'> {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	label: string;
	description?: string;
	id?: string;
}

export function Switch({
	checked,
	onCheckedChange,
	label,
	description,
	className,
	id,
	disabled,
	...props
}: SwitchProps) {
	return (
		<div className={twMerge('flex items-center justify-between gap-3', className)}>
			<span className="min-w-0">
				<label
					htmlFor={id}
					className="block text-xs font-semibold text-text"
					onClick={() => !disabled && onCheckedChange(!checked)}
				>
					{label}
				</label>
				{description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
			</span>
			<button
				id={id}
				type="button"
				role="switch"
				aria-checked={checked}
				disabled={disabled}
				onClick={() => onCheckedChange(!checked)}
				data-slot="switch"
				className={twMerge(
					'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
					'disabled:cursor-not-allowed disabled:opacity-50',
					checked ? 'border-accent bg-accent' : 'border-line-strong bg-subtle',
					className
				)}
				{...props}
			>
				<span
					aria-hidden="true"
					className={twMerge(
						'inline-block h-4 w-4 transform rounded-full bg-surface shadow-xs transition-transform',
						checked ? 'translate-x-[18px]' : 'translate-x-0.5'
					)}
				/>
			</button>
		</div>
	);
}
