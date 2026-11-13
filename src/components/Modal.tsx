import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'

let openModalCount = 0

interface ModalProps extends ComponentProps<'div'> {
	isOpen: boolean
	onClose: () => void
	title?: string
	subtitle?: string
	children: React.ReactNode
	maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl'
	showCloseButton?: boolean
	disableEscapeClose?: boolean
}

const maxWidthClass: Record<string, string> = {
	sm: 'max-w-sm',
	md: 'max-w-md',
	lg: 'max-w-lg',
	xl: 'max-w-xl',
	'2xl': 'max-w-2xl',
	'4xl': 'max-w-4xl',
}

export const Modal: React.FC<ModalProps> = ({
	isOpen,
	onClose,
	title,
	subtitle,
	children,
	maxWidth = 'xl',
	showCloseButton = true,
	disableEscapeClose = false,
	className,
	...props
}: ModalProps) => {
	const dialogRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!isOpen) return

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !disableEscapeClose) {
				onClose()
			}
		}

		openModalCount += 1
		document.body.style.overflow = 'hidden'
		window.addEventListener('keydown', handleKeyDown)

		return () => {
			window.removeEventListener('keydown', handleKeyDown)
			openModalCount = Math.max(0, openModalCount - 1)
			if (openModalCount === 0) {
				document.body.style.overflow = ''
			}
		}
	}, [isOpen, onClose, disableEscapeClose])

	// Retorno de foco ao fechar
	useEffect(() => {
		if (!isOpen) return
		const previousFocus = document.activeElement as HTMLElement | null
		const focusable = dialogRef.current?.querySelector<HTMLElement>('[autofocus], button, [href], input, select, textarea')
		focusable?.focus?.()
		return () => {
			previousFocus?.focus?.()
		}
	}, [isOpen])

	if (!isOpen) return null

	return (
		<div
			data-slot="modal-root"
			className={twMerge(
				'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6',
				'outline-none',
				className,
			)}
			role="dialog"
			aria-modal="true"
			aria-label={title}
			{...props}
		>
			{/* Backdrop — véu translúcido navy */ }
			<div
				data-slot="modal-backdrop"
				className="absolute inset-0 bg-[#0F1238]/45 backdrop-blur-sm transition-opacity"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Card modal — Level 4 elevation */ }
			<div
				ref={dialogRef}
				data-slot="modal-card"
				className={twMerge(
					'relative w-full max-w-lg sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl',
					'flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-card shadow-xl',
					maxWidthClass[maxWidth],
					className,
				)}
			>
				{/* Zona 1: Header */ }
				{title || showCloseButton || subtitle ? (
					<div
						data-slot="modal-header"
						className={twMerge(
							'flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle bg-surface-subtle px-5 py-4 sm:px-6',
						)}
					>
						<div className="flex flex-col gap-0.5">
							{title && (
								<h3
									data-slot="modal-title"
									className="text-sm font-semibold text-text-primary tracking-tight"
								>
									{title}
								</h3>
							)}
							{subtitle && (
								<p className="text-[11px] text-text-muted leading-relaxed">
									{subtitle}
								</p>
							)}
						</div>
						{showCloseButton && (
							<button
								type="button"
								data-slot="modal-close"
								onClick={onClose}
								aria-label="Fechar"
								className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-transparent bg-transparent text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-base"
							>
								<X className="h-4 w-4" aria-hidden="true" />
							</button>
						)}
					</div>
				) : null}

				{/* Zona 2: Body — rolagem suave */ }
				<div
					data-slot="modal-body"
					className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6"
				>
					{children}
				</div>

				{/* Zona 3: Footer — reservada para ações (renderizada pelo consumidor via children quando necessário) */ }
			</div>
		</div>
	)
}
