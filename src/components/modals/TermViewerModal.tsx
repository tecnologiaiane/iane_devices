import React, { useEffect, useRef, useState } from 'react'
import { Modal } from '../Modal'
import { DocumentTerm } from '../../types'
import { formatDate } from '../../utils/formatters'
import { StatusBadge } from '../StatusBadge'
import {
	Printer,
	Download,
	CheckCircle,
	ShieldCheck,
	FileText,
	ExternalLink,
	Loader2,
	AlertTriangle,
	Paperclip,
} from 'lucide-react'
import { dataService } from '../../services/dataStorage'
import { Button } from '../button'
import { Badge } from '../badge'

interface TermViewerModalProps {
	isOpen: boolean
	onClose: () => void
	term: DocumentTerm | null
	onTermUpdated?: () => void
	autoPrint?: boolean
}

export const TermViewerModal: React.FC<TermViewerModalProps> = ({
	isOpen,
	onClose,
	term,
	onTermUpdated,
	autoPrint = false,
}) => {
	const [pdfUrl, setPdfUrl] = useState<string | null>(null)
	const [isLoadingPdf, setIsLoadingPdf] = useState(false)
	const [pdfError, setPdfError] = useState('')
	const [currentStatus, setCurrentStatus] = useState<DocumentTerm['status']>(
		term?.status ?? 'Pendente de Assinatura'
	)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const hasAutoPrintedRef = useRef(false)

	useEffect(() => {
		setCurrentStatus(term?.status ?? 'Pendente de Assinatura')
	}, [term?.id, term?.status])

	useEffect(() => {
		let objectUrl: string | null = null
		let cancelled = false

		const loadPdf = async () => {
			if (!isOpen || !term?.hasFile) {
				setPdfUrl(null)
				setPdfError('')
				setIsLoadingPdf(false)
				return
			}

			setIsLoadingPdf(true)
			setPdfError('')
			const res = await dataService.getTermFile(term.id)
			if (cancelled) return

			if (res.success && res.data) {
				objectUrl = URL.createObjectURL(res.data)
				setPdfUrl(objectUrl)
			} else {
				setPdfError(res.message || 'Não foi possível carregar o PDF deste termo.')
			}
			setIsLoadingPdf(false)
		}

		void loadPdf()

		return () => {
			cancelled = true
			if (objectUrl) URL.revokeObjectURL(objectUrl)
			setPdfUrl(null)
		}
	}, [isOpen, term?.id, term?.hasFile])

	useEffect(() => {
		hasAutoPrintedRef.current = false
	}, [isOpen, term?.id])

	useEffect(() => {
		if (!isOpen || !autoPrint || hasAutoPrintedRef.current) return
		if (term?.hasFile) return

		const timer = window.setTimeout(() => {
			hasAutoPrintedRef.current = true
			window.print()
		}, 350)
		return () => window.clearTimeout(timer)
	}, [isOpen, autoPrint, term?.hasFile, term?.id])

	if (!term) return null

	const linkedDevice = term.deviceId ? dataService.getDevices().find((device) => device.id === term.deviceId) : undefined
	const deviceModel = linkedDevice?.model || term.deviceModel || 'N/A'

	const handlePrint = () => {
		if (pdfUrl && iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.print()
			return
		}
		window.print()
	}

	const handleOpenInNewTab = () => {
		if (pdfUrl) window.open(pdfUrl, '_blank', 'noopener,noreferrer')
	}

	const handleDownload = () => {
		if (!pdfUrl) return
		const link = document.createElement('a')
		link.href = pdfUrl
		link.download = term.fileName || `${term.code}.pdf`
		document.body.appendChild(link)
		link.click()
		link.remove()
	}

	const handleToggleSign = () => {
		const nextStatus = currentStatus === 'Assinado' ? 'Pendente de Assinatura' : 'Assinado'
		setCurrentStatus(nextStatus)
		dataService.updateTermStatus(term.id, nextStatus)
		if (onTermUpdated) onTermUpdated()
	}

	const hasPdf = !!term.hasFile

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={`Visualização de documento: ${term.code}`}
			subtitle={hasPdf ? `${term.type} - PDF original anexado` : `${term.type} - Registro oficial de guarda patrimonial`}
			maxWidth="4xl"
		>
			<div className="space-y-4">
				{/* Actions bar */}
				<div className="flex flex-wrap items-center justify-between gap-3 p-3 radius-base border border-border-subtle bg-surface-subtle no-print">
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold text-text-muted">Situação jurídica:</span>
						<StatusBadge status={currentStatus} type="term" />
						{currentStatus === 'Assinado' && term.signedAt && (
							<span className="text-[11px] text-text-muted">
								(Assinado em {term.signedAt})
							</span>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<button
							onClick={handleToggleSign}
							className={`
								px-3 py-1.5 radius-base text-xs font-semibold transition-colors flex items-center gap-1.5
								${currentStatus === 'Assinado'
									? 'bg-status-warning-bg text-status-warning-fg hover:bg-status-warning-border'
									: 'bg-status-success-bg text-status-success-fg hover:bg-status-success-border shadow-sm'
							}`}
						>
							<CheckCircle className="w-3.5 h-3.5" />
							<span>
								{currentStatus === 'Assinado' ? 'Marcar como pendente' : 'Registrar assinatura'}
							</span>
						</button>

						{hasPdf && pdfUrl && (
							<>
								<Button variant="ghost" size="sm" onClick={handleOpenInNewTab} className="flex items-center gap-1.5">
									<ExternalLink className="w-3.5 h-3.5" />
									<span>Abrir em nova aba</span>
								</Button>

								<Button variant="ghost" size="sm" onClick={handleDownload} className="flex items-center gap-1.5">
									<Download className="w-3.5 h-3.5" />
									<span>Baixar PDF</span>
								</Button>
							</>
						)}

						<Button variant="primary" size="sm" onClick={handlePrint} className="flex items-center gap-1.5">
							<Printer className="w-3.5 h-3.5" />
							<span>Imprimir</span>
						</Button>
					</div>
				</div>

				{hasPdf ? (
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-[11px] text-text-muted">
							<Paperclip className="w-3.5 h-3.5 text-brand-blue-action" />
							<span className="font-code truncate">{term.fileName || `${term.code}.pdf`}</span>
						</div>

						{isLoadingPdf && (
							<div className="flex flex-col items-center justify-center gap-2 py-16 radius-lg border border-border-subtle bg-surface-subtle text-text-muted">
								<Loader2 className="w-6 h-6 animate-spin text-brand-blue-action" />
								<p className="text-xs font-medium">Carregando PDF do termo...</p>
							</div>
						)}

						{!isLoadingPdf && pdfError && (
							<div className="flex items-start gap-2 p-3 radius-base border border-status-danger-border bg-status-danger-bg text-xs text-status-danger-fg">
								<AlertTriangle className="w-4 h-4 text-status-danger-fg shrink-0 mt-0.5" />
								<span>{pdfError}</span>
							</div>
						)}

						{!isLoadingPdf && pdfUrl && (
							<iframe
								ref={iframeRef}
								src={pdfUrl}
								title={`PDF do termo ${term.code}`}
								className="w-full radius-lg border border-border-subtle bg-surface-card"
								style={{ height: '70vh' }}
								onLoad={() => {
									if (!autoPrint || hasAutoPrintedRef.current) return
									hasAutoPrintedRef.current = true
									window.setTimeout(() => iframeRef.current?.contentWindow?.print(), 150)
								}}
							/>
						)}
					</div>
				) : (
					/* Printable Official Document Layout (termo gerado pelo aplicativo) */
					<div
						id="printable-term"
						className="p-8 sm:p-12 bg-surface-card border border-border-subtle radius-lg shadow-sm text-text-primary font-body space-y-6 print:border-none print:shadow-none print:p-0"
					>
						{/* Header of Term */}
						<div className="border-b-2 border-brand-navy-base pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 radius-base bg-brand-navy-base text-white flex items-center justify-center font-bold text-lg">
									<ShieldCheck className="w-6 h-6" />
								</div>
								<div>
									<h2 className="font-display font-semibold text-base uppercase tracking-tight text-brand-navy-base">
										IANE — Gestão de Dispositivos
									</h2>
									<p className="text-xs text-text-muted">
										IANE Indústria e Comércio — Departamento de TI
									</p>
								</div>
							</div>

							<div className="sm:text-right">
								<span className="inline-block text-xs font-code font-bold px-2.5 py-1 bg-surface-subtle border border-border-subtle rounded text-text-primary">
									{term.code}
								</span>
								<p className="text-[11px] text-text-muted mt-1">
									Emissão: {formatDate(term.date)}
								</p>
							</div>
						</div>

						{/* Title */}
						<div className="text-center pt-2">
							<h1 className="font-display font-bold text-lg text-brand-navy-base uppercase tracking-tight">
								{term.title}
							</h1>
							<p className="text-xs text-text-muted italic mt-0.5">
								Ref.: Atribuição e Custódia de Dispositivo Móvel Corporativo — IANE
							</p>
						</div>

						{/* Identification of Parties */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-surface-subtle p-4 radius-base border border-border-subtle">
							<div>
								<h3 className="font-semibold text-brand-navy-base uppercase text-[11px] mb-2 pb-1 border-b border-border-subtle">
									1. Identificação do colaborador
								</h3>
								<div className="space-y-1 text-text-muted">
									<p><span className="font-semibold text-text-primary">Nome:</span> {term.collaboratorName || 'Não identificado'}</p>
									<p><span className="font-semibold text-text-primary">Matrícula:</span> <span className="font-code">{term.collaboratorRegistration || '-'}</span></p>
									<p><span className="font-semibold text-text-primary">Departamento:</span> {term.collaboratorDepartment || '-'}</p>
									<p>
										<span className="font-semibold text-text-primary">CPF:</span>{' '}
										<span className="font-code">{term.collaboratorCpf || 'Não informado'}</span>
									</p>
								</div>
							</div>

							<div>
								<h3 className="font-semibold text-brand-navy-base uppercase text-[11px] mb-2 pb-1 border-b border-border-subtle">
									2. Identificação do ativo e linha
								</h3>
								<div className="space-y-1 text-text-muted">
									<p><span className="font-semibold text-text-primary">Identificador patrimonial:</span> <span className="font-code font-semibold">{term.deviceTag || 'N/A'}</span></p>
									<p><span className="font-semibold text-text-primary">Modelo:</span> {deviceModel}</p>
									<p><span className="font-semibold text-text-primary">IMEI:</span> <span className="font-code">{term.deviceImei || 'N/A'}</span></p>
									<p><span className="font-semibold text-text-primary">Linha telefônica:</span> <span className="font-code font-semibold">{term.phoneNumber || 'Não associada'}</span></p>
								</div>
							</div>
						</div>

						{/* Accessories List */}
						{term.accessoriesList && term.accessoriesList.length > 0 && (
							<div className="text-xs">
								<h3 className="font-semibold text-brand-navy-base uppercase text-[11px] mb-2">
									3. Acessórios e itens entregues
								</h3>
								<div className="flex flex-wrap gap-2">
									{term.accessoriesList.map((acc, idx) => (
										<span key={idx} className="px-2.5 py-1 radius-base bg-surface-subtle border border-border-subtle text-text-muted text-xs">
											✓ {acc}
										</span>
									))}
								</div>
							</div>
						)}

						{/* Legal Clauses */}
						<div className="text-xs text-text-muted space-y-2">
							<h3 className="font-semibold text-brand-navy-base uppercase text-[11px] mb-1">
								4. Cláusulas e condições de uso
							</h3>
							<ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
								{term.clauses.map((clause, idx) => (
									<li key={idx}>{clause}</li>
								))}
							</ol>
						</div>

						{term.notes && (
							<div className="text-xs bg-status-warning-bg p-3 radius-base border border-status-warning-border text-status-warning-fg">
								<span className="font-semibold">Observações registradas:</span> {term.notes}
							</div>
						)}

						{/* Signature Lines */}
						<div className="pt-10 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs text-center">
							<div className="flex flex-col items-center">
								<div className="w-64 border-b border-border-strong mb-2"></div>
								<p className="font-bold text-text-primary">{term.collaboratorName || 'Assinatura do colaborador'}</p>
								<p className="text-[11px] text-text-muted">
									{term.collaboratorRegistration ? `Matrícula: ${term.collaboratorRegistration}` : 'Colaborador responsável'}
								</p>
								{currentStatus === 'Assinado' ? (
									<span className="mt-2 text-[10px] text-status-success-fg font-medium bg-status-success-bg px-2 py-0.5 rounded border border-status-success-border">
										Assinado digitalmente
									</span>
								) : (
									<span className="mt-2 text-[10px] text-status-warning-fg font-medium bg-status-warning-bg px-2 py-0.5 rounded border border-status-warning-border">
										Aguardando assinatura
									</span>
								)}
							</div>

							<div className="flex flex-col items-center">
								<div className="w-64 border-b border-border-strong mb-2"></div>
								<p className="font-bold text-text-primary">Gestão de TI & Telecomunicações</p>
								<p className="text-[11px] text-text-muted">Patrimônio corporativo</p>
								<span className="mt-2 text-[10px] text-text-muted font-code">
									Data: {formatDate(term.date)}
								</span>
							</div>
						</div>

						{!term.hasFile && (
							<div className="flex items-center justify-center gap-1.5 text-[10px] text-text-muted no-print">
								<FileText className="w-3 h-3" />
								Documento gerado pelo aplicativo. Nenhum PDF foi anexado a este termo.
							</div>
						)}
					</div>
				)}
			</div>
		</Modal>
	)
}
