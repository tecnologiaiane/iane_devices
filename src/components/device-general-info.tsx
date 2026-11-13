import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';
import { StatusBadge } from './StatusBadge';

export interface DeviceGeneralInfoProps extends ComponentProps<'div'> {
	brand: string;
	model: string;
	imei: string;
	serialNumber: string;
	condition: string;
	department: string;
	line: string | null;
	responsible: string | null;
	observations: string | null;
}

function InfoItem({
	label,
	value,
	mono = false,
	className,
}: {
	label: string;
	value: string;
	mono?: boolean;
	className?: string;
}) {
	return (
		<div className={twMerge('rounded-md border border-line bg-subtle/50 p-3', className)}>
			<dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
				{label}
			</dt>
			<dd className={twMerge('break-words text-xs font-medium text-text', mono && 'font-mono')}>
				{value}
			</dd>
		</div>
	);
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
		<div data-slot="device-general-info" className={twMerge('space-y-3', className)} {...props}>
			<dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<InfoItem label="Marca" value={brand || '—'} />
				<InfoItem label="Modelo" value={model || '—'} />
				<InfoItem label="IMEI" value={imei || '—'} mono />
				<InfoItem label="Nº de série" value={serialNumber || '—'} mono />
				<div className="rounded-md border border-line bg-subtle/50 p-3">
					<dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
						Estado de conservação
					</dt>
					<dd>
						<StatusBadge status={condition} type="condition" />
					</dd>
				</div>
				<InfoItem label="Departamento" value={department || 'Não informado'} />
				<InfoItem label="Linha telefônica" value={line || 'Sem linha'} mono />
				<InfoItem
					label="Responsável"
					value={responsible || 'Estoque do Gestor de Telefonia'}
					className="sm:col-span-2 lg:col-span-2"
				/>
				<div className="rounded-md border border-line bg-subtle/50 p-3 sm:col-span-2 lg:col-span-3">
					<dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
						Observações
					</dt>
					<dd className="whitespace-pre-wrap text-xs leading-relaxed text-text">
						{observations || 'Nenhuma observação registrada.'}
					</dd>
				</div>
			</dl>
		</div>
	);
}
