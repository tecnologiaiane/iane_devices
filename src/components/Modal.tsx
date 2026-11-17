import React, { useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { ComponentProps } from 'react'
import { X } from './icons'
import { cn } from '../lib/utils'

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
	useEffect(() => {
		if (!isOpen) return

		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'

		return () => {
			document.body.style.overflow = previousOverflow
		}
	}, [isOpen])

	return (
		<Dialog.Root
			open={isOpen}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
		>
			<Dialog.Portal>
				{/* Backdrop — véu translúcido navy */}
				<Dialog.Overlay className="fixed inset-0 z-50 bg-[#0A1F3C]/50 backdrop-blur-[2px] transition-opacity" />

				<div
					data-slot="modal-root"
					className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
				>
					{/* Card modal — Level 4 elevation */}
					<Dialog.Content
						data-slot="modal-card"
						onEscapeKeyDown={(event) => {
							if (disableEscapeClose) event.preventDefault()
						}}
						aria-label={title}
						aria-modal="true"
						className={cn(
							'pointer-events-auto relative flex max-h-full w-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-card shadow-xl outline-none',
							'relative w-full max-w-lg sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl',
							maxWidthClass[maxWidth],
							className,
						)}
						{...props}
					>
						{title || subtitle || showCloseButton ? (
							<div
								data-slot="modal-header"
								className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle bg-surface-card px-5 py-4 sm:px-6"
							>
								<div className="flex flex-col gap-0.5">
									{title ? (
										<Dialog.Title
											data-slot="modal-title"
											className="text-sm font-semibold text-text-primary tracking-tight"
										>
											{title}
										</Dialog.Title>
									) : (
										<Dialog.Title className="sr-only">Janela</Dialog.Title>
									)}
									{subtitle && (
										<Dialog.Description className="text-[11px] text-text-muted leading-relaxed">
											{subtitle}
										</Dialog.Description>
									)}
								</div>
								{showCloseButton && (
									<Dialog.Close asChild>
										<button
											type="button"
											data-slot="modal-close"
											aria-label="Fechar"
											className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-base border-transparent bg-transparent text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-action/30"
										>
											<X className="h-4 w-4" aria-hidden="true" />
										</button>
									</Dialog.Close>
								)}
							</div>
						) : (
							<Dialog.Title className="sr-only">Janela</Dialog.Title>
						)}

						{/* Zona 2: Body — rolagem suave */}
						<div
							data-slot="modal-body"
							className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6"
						>
							{children}
						</div>
					</Dialog.Content>
				</div>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
