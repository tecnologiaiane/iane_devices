import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'

export interface TabItem {
	id: string
	label: string
	count?: number
}

export interface DeviceTabsProps extends ComponentProps<'div'> {
	tabs: TabItem[]
	activeId: string
	onTabChange: (id: string) => void
}

export function DeviceTabs({ tabs, activeId, onTabChange, className, ...props }: DeviceTabsProps) {
	return (
		<div
			data-slot="device-tabs"
			role="tablist"
			aria-label="Seções do dispositivo"
			className={twMerge(
				'flex shrink-0 gap-1 overflow-x-auto border-b border-border-subtle bg-surface-card px-2 sm:px-4',
				className
			)}
			{...props}
		>
			{tabs.map((tab) => {
				const isActive = activeId === tab.id
				return (
					<button
						key={tab.id}
						type="button"
						role="tab"
						id={`device-tab-${tab.id}`}
						aria-selected={isActive}
						aria-controls={`device-tabpanel-${tab.id}`}
						onClick={() => onTabChange(tab.id)}
						className={twMerge(
							'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-3 text-xs font-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-navy-base sm:px-3',
							isActive
								? 'border-brand-blue-action font-semibold text-brand-blue-action'
								: 'border-transparent font-medium text-text-muted hover:text-text-primary'
						)}
					>
						{tab.label}
						{tab.count !== undefined && (
							<span
								className={twMerge(
									'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
									isActive ? 'bg-surface-subtle text-brand-blue-action' : 'bg-surface-subtle text-text-muted'
								)}
							>
								{tab.count}
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}
