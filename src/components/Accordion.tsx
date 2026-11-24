import React, { useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/utils'

interface AccordionProps {
	title: string
	icon?: React.ReactNode
	defaultOpen?: boolean
	/** Estado controlado externamente. Quando informado, substitui o estado interno. */
	isOpen?: boolean
	/** Chamado ao clicar no cabeçalho. Use com `isOpen` para controlar o accordion. */
	onToggle?: () => void
	children: React.ReactNode
}

export const Accordion: React.FC<AccordionProps> = ({
	title,
	icon,
	defaultOpen = false,
	isOpen: controlledIsOpen,
	onToggle,
	children,
}) => {
	const [internalOpen, setInternalOpen] = useState(defaultOpen)
	const isOpen = controlledIsOpen ?? internalOpen
	const instanceId = useId().replace(/:/g, '')
	const headerId = `${instanceId}-header`
	const contentId = `${instanceId}-content`
	const panelRef = useRef<HTMLDivElement>(null)

	// Estado exclusivo desta instância: nenhum valor é compartilhado entre accordions.
	const handleToggle = () => {
		if (controlledIsOpen === undefined) setInternalOpen((open) => !open)
		onToggle?.()
	}

	// Anima a altura real do conteúdo sem valor máximo fixo (que cortaria itens).
	// A transição de grid-template-rows 0fr -> 1fr não funciona no Chromium atual.
	useLayoutEffect(() => {
		const panel = panelRef.current
		const content = panel?.firstElementChild as HTMLElement | null
		if (!panel || !content) return

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			panel.style.transition = 'none'
			panel.style.maxHeight = isOpen ? 'none' : '0px'
			return
		}

		panel.style.transition = ''
		if (isOpen) {
			panel.style.maxHeight = `${content.scrollHeight}px`
			const handleTransitionEnd = (event: TransitionEvent) => {
				if (event.propertyName === 'max-height') panel.style.maxHeight = 'none'
			}
			panel.addEventListener('transitionend', handleTransitionEnd)
			return () => panel.removeEventListener('transitionend', handleTransitionEnd)
		}

		if (panel.style.maxHeight === 'none') {
			panel.style.maxHeight = `${panel.scrollHeight}px`
			void panel.offsetHeight
		}
		panel.style.maxHeight = '0px'
	}, [isOpen])

	return (
		<div className="radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden">
			<h2 className="border-b border-border-subtle">
				<button
					type="button"
					id={headerId}
					aria-expanded={isOpen}
					aria-controls={contentId}
					onClick={(event) => {
						event.stopPropagation()
						handleToggle()
					}}
					className={cn(
						'flex w-full items-center justify-between px-5 py-3.5 text-left',
						'cursor-pointer transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-action/30',
					)}
				>
					<span className="flex items-center gap-2">
						{icon && <span className="shrink-0">{icon}</span>}
						<span className="text-sm font-semibold text-text-primary">{title}</span>
					</span>
					{isOpen ? (
						<ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
					) : (
						<ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
					)}
				</button>
			</h2>
			<div
				ref={panelRef}
				className="max-h-0 overflow-hidden transition-[max-height] duration-200 ease-out motion-reduce:transition-none"
			>
				<div
					id={contentId}
					role="region"
					aria-label={title}
					aria-hidden={!isOpen}
					inert={!isOpen}
					className="p-4"
				>
					{children}
				</div>
			</div>
		</div>
	)
}
