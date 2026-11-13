import { useEffect, useId, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { ExternalLink, Eye, Loader2 } from 'lucide-react'
import { DeviceDetailHeader } from './device-detail-header'
import { DeviceTabs } from './device-tabs'
import { DeviceTimeline } from './device-timeline'
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
			<p className="radius-base border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">
				Nenhum termo vinculado a este aparelho.
			</p>
		)
	}

	return (
		<ul className="space-y-2">
			{terms.map((term) => (
				<li
					key={term.id}
					className="flex flex-col gap-3 radius-base border border-border-subtle bg-surface-card p-3 sm:flex-row sm:items-center sm:justify-between"
				>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<span className="font-code text-xs font-semibold text-text-primary">{term.code}</span>
							<StatusBadge status={term.status} type="term" size="sm" />
						</div>
						<p className="mt-1 text-xs text-text-muted">
							{term.type} &middot; {formatDate(term.date)}
						</p>
						<p className="truncate text-[11px] text-text-muted" title={term.title}>
							{term.title}
						</p>
					</div>
					{onViewTerm && (
						<Button
							variant="secondary"
							size="md"
							onClick={() => onViewTerm(term)}
							aria-label={`Abrir termo ${term.code}`}
							title="Abrir termo"
							className="w-full shrink-0 sm:w-auto"
						>
							<Eye className="h-4 w-4" aria-hidden="true" />
						</Button>
					)}
				</li>
			))}
		</ul>
	)
}

function DeviceLabel({
	tag,
	qrUrl,
	qrLoading,
}: {
	tag: string
	qrUrl: string | null
	qrLoading?: boolean
}) {
	return (
		<div className="radius-lg border border-border-subtle bg-surface-subtle p-4">
			<p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Etiqueta QR</p>
			<p className="mt-1 text-xs text-text-muted">
				Aponte a câmera para abrir o relatório público do aparelho, sem necessidade de login.
			</p>

			{qrLoading ? (
				<div className="mt-4 flex items-center justify-center gap-2 py-8 text-xs text-text-muted">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					Carregando etiqueta…
				</div>
			) : !qrUrl ? (
				<p className="mt-4 radius-base border border-dashed border-border-subtle px-4 py-8 text-center text-xs text-text-muted">
					Não foi possível gerar o link seguro da etiqueta. Reabra o aparelho para tentar novamente.
				</p>
			) : (
				<div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
					<QrCode value={qrUrl} size={140} alt={`QR Code do aparelho ${tag}`} />
					<div className="min-w-0 space-y-2 text-center sm:text-left">
						<p className="break-all font-code text-[11px] leading-relaxed text-text-muted">{qrUrl}</p>
						<a
							href={qrUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue-action hover:underline"
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
	const [activeTab, setActiveTab] = useState<DetailTabId>('geral')
	const dialogRef = useRef<HTMLDivElement>(null)
	const titleId = useId()

	useEffect(() => {
		setActiveTab('geral')
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
		{ id: 'geral', label: 'Informações gerais' },
		{ id: 'historico', label: 'Histórico', count: history.length },
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
				className="absolute inset-0 bg-[#0F1238]/45 backdrop-blur-sm"
				onClick={onClose}
				aria-hidden="true"
			/>

			<div
				ref={dialogRef}
				data-slot="device-detail-popup"
				className={twMerge(
					'relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden radius-lg border border-border-subtle bg-surface-card shadow-lg sm:max-h-[calc(100dvh-2rem)]',
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
					className="flex-1 overflow-y-auto px-4 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-navy-base sm:px-6"
				>
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

					{activeTab === 'historico' && <DeviceTimeline events={history} />}

					{activeTab === 'termos' && <DeviceTerms terms={terms} onViewTerm={onViewTerm} />}

					{activeTab === 'etiqueta' && (
						<DeviceLabel tag={device.tag} qrUrl={qrUrl} qrLoading={qrLoading} />
					)}
				</div>
			</div>
		</div>
	)
}
