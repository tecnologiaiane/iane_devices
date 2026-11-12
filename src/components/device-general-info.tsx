import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { Badge } from './badge'

export interface DeviceGeneralInfoProps extends ComponentProps<'div'> {
	brand: string
	model: string
	imei: string
	serialNumber: string
	condition: string
	department: string
	line: string | null
	responsible: string | null
	observations: string | null
}

export function DeviceGeneralInfo({
	brand,
	model,
	imei,
	serialNumber,
	condition,
	department,
	line,
	responsible,
	observations,
	className,
	...props
}: DeviceGeneralInfoProps) {
	return (
		<div
			data-slot="device-general-info"
			className={twMerge('space-y-4', className)}
			{...props}
		>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				<div className="p-3 bg-surface border border-border rounded-lg">
					<span className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wider block mb-1">
						Marca
					</span>
					<span className="text-xs font-medium text-foreground">{brand}</span>
				</div>
				<div className="p-3 bg-surface border border-border rounded-lg">
					<span className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wider block mb-1">
						Modelo
					</span>
					<span className="text-xs font-medium text-foreground">{model}</span>
				</div>
				<div className="p-3 bg-surface border border-border rounded-lg">
					<span className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wider block mb-1">
						IMEI
					</span>
					<span className="text-xs font-mono text-foreground-subtle break-all">{imei || '—'}</span>
				</div>
				<div className="p-3 bg-surface border border-border rounded-lg">
					<span className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wider block mb-1">
						Nº de Série
					</span>
					<span className="text-xs font-mono text-foreground-subtle break-all">{serialNumber || '—'}</span>
				</div>
				<div className="p-3 bg-surface border border-border rounded-lg">
					<span className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wider block mb-1">
						Estado de Conservação
					</span>
					<Badge variant="info" size="sm" className="mt-0.5">
						<span className="w-1.5 h-1.5 rounded-full bg-iane-600 shrink-0" aria-hidden="true" />
						{condition}
					</Badge>
				</div>
				<div className="p-3 bg-surface border border-border rounded-lg">
					<span className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wider block mb-1">
						Departamento
					</span>
					<span className="text-xs text-foreground-subtle">{department}</span>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				<div className="p-3 bg-surface border border-border rounded-lg">
					<span className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wider block mb-1">
						Linha Telefônica
					</span>
					<span className="text-xs font-mono text-foreground-subtle break-all">{line || 'Sem linha'}</span>
				</div>
				<div className="p-3 bg-surface border border-border rounded-lg">
					<span className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wider block mb-1">
						Responsável
					</span>
					<span className="text-xs text-foreground-subtle">{responsible || 'Estoque do Gestor de Telefonia'}</span>
				</div>
				<div className="p-3 bg-surface border border-border rounded-lg col-span-2 sm:col-span-3">
					<span className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wider block mb-1">
						Observações
					</span>
					<p className="text-xs text-foreground-subtle leading-relaxed whitespace-pre-wrap">
						{observations || 'Nenhuma observação registrada.'}
					</p>
				</div>
			</div>
		</div>
	)
}
