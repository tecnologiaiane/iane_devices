import { twMerge } from 'tailwind-merge'
import type { ComponentProps, ReactNode } from 'react'
import { StatusBadge } from './StatusBadge'
import { formatCurrency, formatDate } from '../utils/formatters'

export interface DeviceGeneralInfoProps extends ComponentProps<'div'> {
	brand: string
	model: string
	imei: string
	imei2?: string
	serialNumber: string
	condition: string
	department: string
	sector?: string
	unit?: string
	line: string | null
	responsible: string | null
	observations: string | null
	purchaseDate?: string
	purchaseValue?: number
	status: string
}

function InfoItem({
	label,
	children,
	mono = false,
	className,
}: {
	label: string
	children: ReactNode
	mono?: boolean
	className?: string
}) {
	return (
		<div className={twMerge('radius-base border border-border-subtle bg-surface-subtle p-3', className)}>
			<dt className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</dt>
			<dd
				className={twMerge(
					'mt-1 break-words text-xs text-text-primary',
					mono && 'font-code tabular-nums'
				)}
			>
				{children}
			</dd>
		</div>
	)
}

export function DeviceGeneralInfo({
	brand,
	model,
	imei,
	imei2,
	serialNumber,
	condition,
	department,
	sector,
	unit,
	line,
	responsible,
	observations,
	purchaseDate,
	purchaseValue,
	status,
	className,
	...props
}: DeviceGeneralInfoProps) {
	return (
		<div
			data-slot="device-general-info"
			className={twMerge('space-y-4', className)}
			{...props}
		>
			<dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<InfoItem label="Marca">{brand || '—'}</InfoItem>
				<InfoItem label="Modelo">{model || '—'}</InfoItem>
				<InfoItem label="Situação">
					<StatusBadge status={status} type="device" size="sm" />
				</InfoItem>

				<InfoItem label="IMEI 1" mono>
					{imei || '—'}
				</InfoItem>
				<InfoItem label="IMEI 2" mono>
					{imei2 || '—'}
				</InfoItem>
				<InfoItem label="Nº de série" mono>
					{serialNumber || '—'}
				</InfoItem>

				<InfoItem label="Estado de conservação">
					<StatusBadge status={condition} type="condition" size="sm" />
				</InfoItem>
				<InfoItem label="Departamento">{department || 'Não informado'}</InfoItem>
				<InfoItem label="Setor">{sector || 'Não informado'}</InfoItem>

				<InfoItem label="Unidade">{unit || 'Não informado'}</InfoItem>
				<InfoItem label="Linha telefônica" mono>
					{line || <span className="font-body italic text-text-muted">Sem linha associada</span>}
				</InfoItem>
				<InfoItem label="Responsável">
					{responsible || <span className="font-body italic text-text-muted">Estoque do Gestor de Telefonia</span>}
				</InfoItem>

				<InfoItem label="Data de compra" mono>
					{formatDate(purchaseDate)}
				</InfoItem>
				<InfoItem label="Valor de compra" mono>
					{formatCurrency(purchaseValue)}
				</InfoItem>

				<InfoItem label="Observações" className="sm:col-span-2 lg:col-span-3">
					<p className="whitespace-pre-wrap leading-relaxed">
						{observations || <span className="font-body italic text-text-muted">Nenhuma observação registrada.</span>}
					</p>
				</InfoItem>
			</dl>
		</div>
	)
}
