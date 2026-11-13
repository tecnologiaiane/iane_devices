import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { DeviceDetailHeader } from './device-detail-header'
import { DeviceTabs } from './device-tabs'
import { DeviceTimeline } from './device-timeline'
import { DeviceDetailFooter } from './device-detail-footer'
import { DeviceGeneralInfo } from './device-general-info'
import { QrCode } from './QrCode'
import { Badge } from './badge'

export interface DeviceDetailProps extends ComponentProps<'div'> {
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
		<div
			data-slot="device-detail-root"
			className={twMerge('fixed inset-0 z-50 overflow-y-auto', className)}
			role="dialog"
			aria-modal="true"
			{...props}
		>
			<div
				data-slot="device-detail-backdrop"
				className="fixed inset-0 bg-ink-900/60 backdrop-blur-xs transition-opacity"
				onClick={onClose}
				aria-hidden="true"
			/>
			<div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
				<div
					data-slot="device-detail-popup"
					className={twMerge(
						'relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all w-full my-8 border border-ink-200',
						'modal:zoom-in modal:fade-in duration-300',
						className
					)}
					onClick={(e) => e.stopPropagation()}
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
					<div className="px-6 py-5 max-h-[calc(85vh-120px)] overflow-y-auto">
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
						<div className="mt-6 p-4 bg-ink-50 border border-ink-200 rounded-lg">
							<div className="flex items-center gap-2 mb-2">
								<span className="text-[10px] font-medium text-ink-500 uppercase tracking-wider">
									Etiqueta QR
								</span>
								<Badge variant="secondary" size="sm">
									Imprimir
								</Badge>
							</div>
							<div className="flex flex-col items-center gap-2">
								<QrCode value={`http://app.telefonia.local/report/device/${device.tag}`} size={160} />
								<p className="text-[10px] font-mono text-ink-600 break-all max-w-xs">
									http://app.telefonia.local/report/device/{device.tag}
								</p>
							</div>
						</div>
					</div>
					<DeviceDetailFooter createdAt={null} onClose={onClose} />
				</div>
			</div>
		</div>
	)
}
