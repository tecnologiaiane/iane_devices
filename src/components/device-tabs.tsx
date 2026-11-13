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

export function DeviceTabs({
	tabs,
	activeId,
	onTabChange,
	className,
	...props
}: DeviceTabsProps) {
	return (
		<div
			data-slot="device-tabs"
			className={twMerge(
				'border-b border-ink-200 flex gap-4 px-5 pb-1 text-xs font-medium',
				className
			)}
			{...props}
		>
			{tabs.map((tab) => {
				const isActive = activeId === tab.id
				return (
					<button
						key={tab.id}
						data-slot="tab"
						data-active={isActive ? '' : undefined}
						onClick={() => onTabChange(tab.id)}
						className={twMerge(
							'flex items-center gap-1.5 py-3 border-b-2 whitespace-nowrap transition-colors',
							isActive
								? 'border-iane-600 text-iane-700 font-semibold'
								: 'border-transparent text-ink-500 hover:text-ink-900 hover:bg-ink-100/50',
							className
						)}
					>
						{tab.label}
						{tab.count !== undefined && (
							<span className="text-ink-500">({tab.count})</span>
						)}
					</button>
				)
			})}
		</div>
	)
}
