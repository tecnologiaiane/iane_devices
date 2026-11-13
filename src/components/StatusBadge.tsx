import React from 'react'
import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import type {
	DeviceStatus,
	LineStatus,
	CollaboratorStatus,
	TermStatus,
	DeviceCondition,
} from '../types'

type SemanticStatus = 'success' | 'warning' | 'danger' | 'info'

interface StatusBadgeProps extends ComponentProps<'span'> {
	status:
		| DeviceStatus
		| LineStatus
		| CollaboratorStatus
		| TermStatus
		| DeviceCondition
		| string
	type?: 'device' | 'line' | 'collaborator' | 'term' | 'condition' | 'request'
	size?: 'sm' | 'md'
	showDot?: boolean
}

/**
 * Mapeia cada status de negócio para uma das 4 semânticas do DESIGN.md v3.5.
 * Mantenha esta lista sincronizada com os valores reais de status do banco.
 */
function toSemantic(status: string): SemanticStatus {
	const s = status.trim()

	// Sucesso / Aprovado / Concluído
	const success = [
		'Disponível',
		'Assinado',
		'Aprovada',
		'Baixado',
		'Novo',
		'Excelente',
		'Concluído',
		'Concluido',
		'Entregue',
		'Ativo',
		'Ativa',
	]
	if (success.includes(s)) return 'success'

	// Atenção / Pendente / Em Análise
	const warning = [
		'Aguardando avaliação',
		'Pendente de Assinatura',
		'Pendente de aprovação',
		'Reservado',
		'Regular',
		'Bom',
		'Pendente',
		'Em Análise',
		'Em analise',
		'Aguardando',
	]
	if (warning.includes(s)) return 'warning'

	// Crítico / Atrasado / Erro
	const danger = [
		'Extraviado',
		'Cancelada',
		'Desligado',
		'Recusada',
		'Danificado',
		'Suspensa',
		'Em processo de cancelamento',
		'Atrasado',
		'Erro',
		'Falha',
	]
	if (danger.includes(s)) return 'danger'

	// Informativo / Em Andamento (default)
	return 'info'
}

const semanticStyles: Record<SemanticStatus, string> = {
	success: 'border-status-success-border bg-status-success-bg text-status-success-fg',
	warning: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg',
	danger: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg',
	info: 'border-status-info-border bg-status-info-bg text-status-info-fg',
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
	status,
	type = 'device',
	size = 'md',
	showDot = true,
	className,
	...props
}: StatusBadgeProps) => {
	const semantic = toSemantic(String(status))
	const sizeClasses =
		size === 'sm'
			? 'h-6 px-2 py-0.5 text-[11px] font-semibold'
			: 'h-7 px-2.5 py-0.5 text-xs font-semibold'

	return (
		<span
			data-slot="status-badge"
			data-semantic={semantic}
			data-size={size}
			className={twMerge(
				'inline-flex items-center gap-1.5 rounded-full border font-medium tracking-tight whitespace-nowrap shrink-0',
				semanticStyles[semantic],
				sizeClasses,
				className,
			)}
			{...props}
		>
			{showDot && (
				<span
					className="shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-60"
					aria-hidden="true"
				/>
			)}
			<span className="leading-none">{status}</span>
		</span>
	)
}
