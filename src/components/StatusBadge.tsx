import {
	AlertTriangle,
	Ban,
	CheckCircle2,
	CircleDashed,
	Clock3,
	Info,
	LoaderCircle,
	MinusCircle,
	XCircle,
} from 'lucide-react';
import {
	DeviceStatus,
	LineStatus,
	CollaboratorStatus,
	TermStatus,
	DeviceCondition,
} from '../types';

interface StatusBadgeProps {
	status: DeviceStatus | LineStatus | CollaboratorStatus | TermStatus | DeviceCondition | string;
	type?: 'device' | 'line' | 'collaborator' | 'term' | 'condition' | 'request';
	size?: 'sm' | 'md';
}

type Tone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

const TONE_STYLES: Record<Tone, { badge: string; icon: string; Icon: typeof Info }> = {
	neutral: {
		badge: 'border-line bg-subtle text-muted',
		icon: 'text-muted',
		Icon: CircleDashed,
	},
	success: {
		badge: 'border-ok-bd bg-ok-bg text-ok-fg',
		icon: 'text-ok-fg',
		Icon: CheckCircle2,
	},
	info: {
		badge: 'border-info-bd bg-info-bg text-info-fg',
		icon: 'text-info-fg',
		Icon: Info,
	},
	warning: {
		badge: 'border-warn-bd bg-warn-bg text-warn-fg',
		icon: 'text-warn-fg',
		Icon: AlertTriangle,
	},
	danger: {
		badge: 'border-danger-bd bg-danger-bg text-danger-fg',
		icon: 'text-danger-fg',
		Icon: XCircle,
	},
};

/** Ícone por significado, não apenas por cor: o texto sempre acompanha. */
function resolveStatus(status: string): Tone {
	switch (status) {
		case 'Disponível':
		case 'Assinado':
		case 'Aprovada':
		case 'Ativo':
		case 'Novo':
			return 'success';

		case 'Em uso':
		case 'Em Uso':
		case 'Em andamento':
		case 'Em manutenção':
		case 'Aguardando avaliação':
		case 'Pendente de Assinatura':
		case 'Pendente de aprovação':
		case 'Suspensa':
		case 'Em processo de cancelamento':
		case 'Aguardando baixa patrimonial':
			return 'warning';

		case 'Extraviado':
		case 'Cancelada':
		case 'Desligado':
		case 'Recusada':
		case 'Danificado':
		case 'Atrasado':
		case 'Com erro':
			return 'danger';

		case 'Ativa':
		case 'Excelente':
		case 'Bom':
		case 'Regular':
			return 'info';

		case 'Reservado':
		case 'Férias':
		case 'Afastado':
		case 'Arquivado':
		case 'Baixado':
		case 'Inativo':
			return 'neutral';

		default:
			return 'neutral';
	}
}

function resolveIcon(status: string, tone: Tone): typeof Info {
	if (status === 'Em manutenção' || status === 'Pendente de aprovação') return LoaderCircle;
	if (status === 'Pendente de Assinatura' || status === 'Aguardando avaliação') return Clock3;
	if (status === 'Baixado' || status === 'Cancelada' || status === 'Desligado') return Ban;
	if (status === 'Inativo' || status === 'Arquivado') return MinusCircle;
	return TONE_STYLES[tone].Icon;
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
	const tone = resolveStatus(status);
	const styles = TONE_STYLES[tone];
	const Icon = resolveIcon(status, tone);
	const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

	return (
		<span
			data-slot="status-badge"
			data-tone={tone}
			className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border font-medium tracking-tight ${styles.badge} ${sizeClasses}`}
		>
			<Icon className={`h-3 w-3 shrink-0 ${styles.icon}`} aria-hidden="true" />
			<span>{status}</span>
		</span>
	);
}
