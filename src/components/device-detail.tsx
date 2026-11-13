import { useEffect, useId, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { DeviceDetailHeader } from './device-detail-header'
import { DeviceTabs } from './device-tabs'
import { DeviceTimeline } from './device-timeline'
import { DeviceDetailFooter } from './device-detail-footer'
import { DeviceGeneralInfo } from './device-general-info'
import { QrCode } from './QrCode'
import { Button } from './button'
import { StatusBadge } from './StatusBadge'
import { formatDate } from '../utils/formatters'
import type { DocumentTerm, Movement } from '../types'

type DetailTabId = 'historico' | 'geral' | 'termos' | 'etiqueta'

export interface DeviceDetailProps extends ComponentProps<'div'> {
	device: {
		id: string
		tag: string
		model: string
		status: string
		serialNumber: string
		custodian: string
		brand: string
		imei: string
		imei2?: string
		condition: string
		department: string
		sector?: string
		unit?: string
		line: string | null
		responsible: string | null
		observations: string | null
		purchaseDate?: string
		purchaseValue?: number
		createdAt?: string
	}
	history: Movement[]
	terms: DocumentTerm[]
	qrUrl: string | null
	qrLoading?: boolean
	onViewTerm?: (term: DocumentTerm) => void
	onClose: () => void
}

function DeviceTerms({
	terms,
	onViewTerm,
}: {
	terms: DocumentTerm[]
	onViewTerm?: (term: DocumentTerm) => void
}) {
	if (terms.length === 0) {
		return (
			<p className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-xs text-ink-500">
				Nenhum termo vinculado a este aparelho.
			</p>
		)
	}

	return (
		<ul className="space-y-2">
			{terms.map((term) => (
				<li
					key={term.id}
					className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
				>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<span className="font-mono text-xs font-bold text-ink-900">{term.code}</span>
							<StatusBadge status={term.status} type="term" size="sm" />
						</div>
						<p className="mt-1 text-xs text-ink-600">
							{term.type} &middot; {formatDate(term.date)}
						</p>
						<p className="truncate text-[11px] text-ink-500" title={term.title}>
							{term.title}
						</p>
					</div>
					{onViewTerm && (
						<Button
							variant="secondary"
							size="md"
							onClick={() => onViewTerm(term)}
							className="w-full shrink-0 sm:w-auto"
						>
							Abrir termo
						</Button>
					)}
				</li>
			))}
		</ul>
	)
}

function DeviceLabel({
	tag,
	deviceId,
	qrUrl,
	qrLoading,
}: {
	tag: string
	deviceId: string
	qrUrl: string | null
	qrLoading?: boolean
}) {
	const fallbackUrl =
		typeof window === 'undefined'
			? ''
			: `${window.location.origin}/report/device/${encodeURIComponent(deviceId)}`
	const value = qrUrl || fallbackUrl

	return (
		<div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4">
			<p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Etiqueta QR</p>
			<p className="mt-1 text-xs text-ink-600">
				Aponte a câmera para abrir o relatório público do aparelho, sem necessidade de login.
			</p>

			{qrLoading ? (
				<div className="mt-4 flex items-center justify-center gap-2 py-8 text-xs text-ink-500">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					Carregando etiqueta…
				</div>
			) : (
				<div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
					<QrCode value={value} size={140} alt={`QR Code do aparelho ${tag}`} />
					<div className="min-w-0 space-y-2 text-center sm:text-left">
						<p className="break-all font-mono text-[11px] leading-relaxed text-ink-600">{value}</p>
						<a
							href={value}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 text-xs font-semibold text-iane-700 hover:text-iane-800 hover:underline"
						>
							Abrir relatório
							<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
						</a>
					</div>
				</div>
			)}
		</div>
	)
}

export function DeviceDetail({
	device,
	history,
	terms,
	qrUrl,
	qrLoading = false,
	onViewTerm,
	onClose,
	className,
	...props
}: DeviceDetailProps) {
	const [activeTab, setActiveTab] = useState<DetailTabId>('historico')
	const dialogRef = useRef<HTMLDivElement>(null)
	const titleId = useId()

	useEffect(() => {
		setActiveTab('historico')
	}, [device.id])

	useEffect(() => {
		const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose()
		}
		document.addEventListener('keydown', handleKeyDown)

		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			document.body.style.overflow = previousOverflow
			previousFocus?.focus?.()
		}
	}, [onClose])

	const tabs = [
		{ id: 'historico', label: 'Histórico', count: history.length },
		{ id: 'geral', label: 'Informações gerais' },
		{ id: 'termos', label: 'Termos', count: terms.length },
		{ id: 'etiqueta', label: 'Etiqueta' },
	]

	return (
		<div
			data-slot="device-detail-root"
			className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			{...props}
		>
			<div
				data-slot="device-detail-backdrop"
				className="absolute inset-0 bg-ink-900/60 backdrop-blur-xs"
				onClick={onClose}
				aria-hidden="true"
			/>

			<div
				ref={dialogRef}
				data-slot="device-detail-popup"
				className={twMerge(
					'relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-ink-200 bg-white text-left shadow-2xl sm:max-h-[calc(100dvh-2rem)]',
					className
				)}
			>
				<DeviceDetailHeader
					titleId={titleId}
					tag={device.tag}
					model={device.model}
					status={device.status}
					serialNumber={device.serialNumber}
					custodian={device.custodian}
					onClose={onClose}
				/>

				<DeviceTabs tabs={tabs} activeId={activeTab} onTabChange={(id) => setActiveTab(id as DetailTabId)} />

				<div
					role="tabpanel"
					id={`device-tabpanel-${activeTab}`}
					aria-labelledby={`device-tab-${activeTab}`}
					tabIndex={0}
					className="flex-1 overflow-y-auto px-4 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
				>
					{activeTab === 'historico' && <DeviceTimeline events={history} />}

					{activeTab === 'geral' && (
						<DeviceGeneralInfo
							brand={device.brand}
							model={device.model}
							imei={device.imei}
							imei2={device.imei2}
							serialNumber={device.serialNumber}
							condition={device.condition}
							department={device.department}
							sector={device.sector}
							unit={device.unit}
							line={device.line}
							responsible={device.responsible}
							observations={device.observations}
							purchaseDate={device.purchaseDate}
							purchaseValue={device.purchaseValue}
							status={device.status}
						/>
					)}

					{activeTab === 'termos' && <DeviceTerms terms={terms} onViewTerm={onViewTerm} />}

					{activeTab === 'etiqueta' && (
						<DeviceLabel
							tag={device.tag}
							deviceId={device.id}
							qrUrl={qrUrl}
							qrLoading={qrLoading}
						/>
					)}
				</div>

				<DeviceDetailFooter createdAt={device.createdAt ?? null} onClose={onClose} />
			</div>
		</div>
	)
}
