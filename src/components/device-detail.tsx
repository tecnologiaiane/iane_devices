import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps } from 'react';
import { DeviceDetailHeader } from './device-detail-header';
import { DeviceTabs } from './device-tabs';
import { DeviceTimeline, type TimelineEventData } from './device-timeline';
import { DeviceDetailFooter } from './device-detail-footer';
import { DeviceGeneralInfo } from './device-general-info';
import { EmptyState } from './empty-state';
import { StatusBadge } from './StatusBadge';
import { QrCode } from './QrCode';

export interface DeviceDetailTerm {
	id: string;
	code: string;
	type: string;
	date: string;
	status: string;
}

export interface DeviceDetailProps extends Omit<ComponentProps<'dialog'>, 'onClose'> {
	device: {
		tag: string;
		model: string;
		status: string;
		serialNumber: string;
		custodian: string;
		brand: string;
		imei: string;
		condition: string;
		department: string;
		line: string | null;
		responsible: string | null;
		observations: string | null;
		createdAt: string | null;
	};
	history?: TimelineEventData[];
	terms?: DeviceDetailTerm[];
	qrUrl?: string | null;
	onOpenTerm?: (termId: string) => void;
	onClose: () => void;
}

export function DeviceDetail({
	device,
	history = [],
	terms = [],
	qrUrl,
	onOpenTerm,
	onClose,
	className,
	...props
}: DeviceDetailProps) {
	const [activeTab, setActiveTab] = useState('geral');
	const dialogRef = useRef<HTMLDialogElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dialog.showModal();
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
			previousFocusRef.current?.focus?.();
		};
	}, []);

	const tabs = [
		{ id: 'geral', label: 'Informações Gerais' },
		{ id: 'historico', label: 'Histórico do Dispositivo', count: history.length },
		{ id: 'termos', label: 'Termos', count: terms.length },
		{ id: 'etiqueta', label: 'Etiqueta QR' },
	];

	const resolvedQrUrl =
		qrUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/report/device/${device.tag}`;

	return (
		<dialog
			ref={dialogRef}
			data-slot="device-detail"
			aria-label={`Detalhes do dispositivo ${device.tag}`}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
			className={twMerge(
				'm-auto w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-lg border border-line bg-surface p-0 text-text shadow-xl',
				'open:animate-[modal-in_200ms_ease-out]',
				className
			)}
			{...props}
		>
			<div className="flex max-h-[calc(100dvh-2rem)] flex-col">
				<DeviceDetailHeader
					tag={device.tag}
					model={device.model}
					status={device.status}
					serialNumber={device.serialNumber}
					custodian={device.custodian}
					onClose={onClose}
				/>

				<DeviceTabs tabs={tabs} activeId={activeTab} onTabChange={setActiveTab} />

				<div
					id={`panel-${activeTab}`}
					role="tabpanel"
					aria-labelledby={`tab-${activeTab}`}
					className="flex-1 overflow-y-auto px-5 py-4"
				>
					{activeTab === 'geral' && (
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
					)}

					{activeTab === 'historico' && <DeviceTimeline events={history} />}

					{activeTab === 'termos' && (
						<div className="space-y-2">
							{terms.length === 0 ? (
								<EmptyState
									icon={FileText}
									title="Nenhum termo vinculado"
									description="Os termos gerados em entregas, devoluções e transferências aparecem aqui."
								/>
							) : (
								<ul className="divide-y divide-line rounded-lg border border-line">
									{terms.map((term) => (
										<li
											key={term.id}
											className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
										>
											<div className="min-w-0">
												<p className="font-mono text-xs font-semibold text-text">{term.code}</p>
												<p className="text-[11px] text-muted">
													{term.type} · {term.date}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<StatusBadge status={term.status} type="term" />
												{onOpenTerm && (
													<button
														type="button"
														onClick={() => onOpenTerm(term.id)}
														className="rounded-md px-2 py-1 text-xs font-semibold text-accent transition-colors hover:bg-subtle"
													>
														Abrir
													</button>
												)}
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					)}

					{activeTab === 'etiqueta' && (
						<div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-subtle/50 p-5">
							<QrCode value={resolvedQrUrl} size={180} alt={`QR Code do dispositivo ${device.tag}`} />
							<p className="max-w-sm break-all text-center font-mono text-[11px] text-muted">
								{resolvedQrUrl}
							</p>
						</div>
					)}
				</div>

				<DeviceDetailFooter createdAt={device.createdAt} onClose={onClose} />
			</div>
		</dialog>
	);
}
