import * as Dialog from '@base-ui/react/dialog'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { DeviceDetailHeader } from './device-detail-header'
import { DeviceTabs } from './device-tabs'
import { DeviceTimeline } from './device-timeline'
import { DeviceDetailFooter } from './device-detail-footer'
import { DeviceGeneralInfo } from './device-general-info'
import { QrCode } from './QrCode'
import { Badge } from './badge'

export interface DeviceDetailProps extends ComponentProps<typeof Dialog.Root> {
	className?: string
	device: {
		tag: string
		model: string
		status: string
		serialNumber: string
		custodian: string
		brand: string
		imei: string
		condition: string
		department: string
		line: string | null
		responsible: string | null
		observations: string | null
	}
	onClose: () => void
}

export function DeviceDetail({ device, onClose, className, ...props }: DeviceDetailProps) {
	const tabs = [
		{ id: 'historico', label: 'Histórico do Dispositivo', count: 1 },
		{ id: 'geral', label: 'Informações Gerais' },
		{ id: 'termos', label: 'Termos', count: 1 },
	]

	return (
		<Dialog.Root
			open
			onOpenChange={onClose}
			className={twMerge('w-full max-w-3xl', className)}
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
						'fixed top-1/4 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl bg-surface-raised rounded-xl border border-border shadow-xl flex flex-col overflow-hidden',
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
					<DeviceTabs tabs={tabs} activeId="geral" onTabChange={() => {}} />
					<div className="flex-1 overflow-y-auto p-6">
						{/* Conteúdo padrão: Histórico do Dispositivo */}
						<DeviceTimeline />

						{/* Informações Gerais */}
						<DeviceGeneralInfo
							brand={device.brand}
							model={device.model}
							imei={device.imei}
							serialNumber={device.serialNumber}
							condition={device.condition}
							department={device.department}
							line={device.line}
							responsible={device.responsible}
							observations={device.observations}
						/>

						{/* QR Code para impressão de etiqueta */}
						<div className="mt-6 p-4 bg-surface border border-border rounded-lg">
							<div className="flex items-center gap-2 mb-2">
								<span className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wider">
									Etiqueta QR
								</span>
								<Badge variant="secondary" size="sm">
									Imprimir
								</Badge>
							</div>
							<div className="flex flex-col items-center gap-2">
								<QrCode value={`http://app.telefonia.local/report/device/${device.tag}`} size={160} />
								<p className="text-[10px] font-mono text-foreground-subtle break-all max-w-xs">
									http://app.telefonia.local/report/device/{device.tag}
								</p>
							</div>
						</div>
					</div>
					<DeviceDetailFooter createdAt={null} onClose={onClose} />
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
