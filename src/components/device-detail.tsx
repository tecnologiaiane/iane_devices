import * as Dialog from '@base-ui/react/dialog'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { DeviceDetailHeader } from './device-detail-header'
import { DeviceTabs } from './device-tabs'
import { DeviceTimeline } from './device-timeline'
import { DeviceDetailFooter } from './device-detail-footer'

export interface DeviceDetailProps extends ComponentProps<typeof Dialog.Root> {
	device: {
		tag: string
		model: string
		status: string
		serialNumber: string
		custodian: string
	}
	onClose: () => void
}

export function DeviceDetail({ device, onClose, ...props }: DeviceDetailProps) {
	const tabs = [
		{ id: 'historico', label: 'Linha do Tempo & Passagens por Estoque', count: 1 },
		{ id: 'geral', label: 'Informações Gerais' },
		{ id: 'linha', label: 'Linha Associada' },
		{ id: 'responsavel', label: 'Custódia Atual' },
		{ id: 'termos', label: 'Termos', count: 1 },
		{ id: 'observacoes', label: 'Observações' },
	]

	return (
		<Dialog.Root
			open
			onOpenChange={onClose}
			className={twMerge('w-full max-w-2xl')}
			{...props}
		>
			<Dialog.Portal>
				<Dialog.Backdrop
					className={twMerge(
						'fixed inset-0 z-40 bg-black/50',
						'data-[state=open]:animate-in data-[state=closed]:animate-out',
						'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
					)}
				/>
				<Dialog.Popup
					className={twMerge(
						'fixed top-1/4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl bg-surface-raised rounded-xl border border-border shadow-xl flex flex-col overflow-hidden',
						'data-[state=open]:animate-in data-[state=closed]:animate-out',
						'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2'
					)}
				>
					<DeviceDetailHeader
						tag={device.tag}
						model={device.model}
						status={device.status}
						serialNumber={device.serialNumber}
						custodian={device.custodian}
						onClose={onClose}
					/>
					<DeviceTabs tabs={tabs} activeId="historico" onTabChange={() => {}} />
					<div className="flex-1 overflow-y-auto p-6">
						<DeviceTimeline />
					</div>
					<DeviceDetailFooter createdAt={null} onClose={onClose} />
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
