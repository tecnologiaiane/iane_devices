import React, { useState } from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
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

const ITEM_VALUE = 'content'

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

	// O toggle é feito no clique do cabeçalho: usar onValueChange aqui faz o
	// Radix notificar também as outras instâncias quando o valor controlado muda.
	const handleToggle = () => {
		if (controlledIsOpen === undefined) setInternalOpen((open) => !open)
		onToggle?.()
	}

	return (
		<AccordionPrimitive.Root
			type="single"
			collapsible
			value={isOpen ? ITEM_VALUE : ''}
			className="radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden"
		>
			<AccordionPrimitive.Item value={ITEM_VALUE}>
				<AccordionPrimitive.Header asChild>
					<h2 className="border-b border-border-subtle">
						<AccordionPrimitive.Trigger
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
						</AccordionPrimitive.Trigger>
					</h2>
				</AccordionPrimitive.Header>
				<AccordionPrimitive.Content className="p-4">
					{children}
				</AccordionPrimitive.Content>
			</AccordionPrimitive.Item>
		</AccordionPrimitive.Root>
	)
}
