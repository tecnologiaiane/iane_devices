import { twMerge } from 'tailwind-merge';
import type { ComponentProps, KeyboardEvent } from 'react';

export interface TabItem {
	id: string;
	label: string;
	count?: number;
}

export interface DeviceTabsProps extends ComponentProps<'div'> {
	tabs: TabItem[];
	activeId: string;
	onTabChange: (id: string) => void;
}

export function DeviceTabs({ tabs, activeId, onTabChange, className, ...props }: DeviceTabsProps) {
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();
		const currentIndex = tabs.findIndex((tab) => tab.id === activeId);
		const delta = event.key === 'ArrowRight' ? 1 : -1;
		const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
		onTabChange(tabs[nextIndex].id);
	};

	return (
		<div
			data-slot="device-tabs"
			role="tablist"
			aria-label="Seções do dispositivo"
			onKeyDown={handleKeyDown}
			className={twMerge('flex gap-1 overflow-x-auto border-b border-line px-5', className)}
			{...props}
		>
			{tabs.map((tab) => {
				const isActive = activeId === tab.id;
				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						id={`tab-${tab.id}`}
						aria-selected={isActive}
						aria-controls={`panel-${tab.id}`}
						tabIndex={isActive ? 0 : -1}
						onClick={() => onTabChange(tab.id)}
						className={twMerge(
							'-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-3 text-xs font-medium transition-colors',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
							isActive
								? 'border-accent font-semibold text-accent'
								: 'border-transparent text-muted hover:border-line-strong hover:text-text'
						)}
					>
						{tab.label}
						{tab.count !== undefined && (
							<span
								className={twMerge(
									'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
									isActive ? 'bg-accent/10 text-accent' : 'bg-subtle text-muted'
								)}
							>
								{tab.count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
