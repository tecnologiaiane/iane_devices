import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
	label: string;
	onClick: () => void;
}

export interface ToastInput {
	title: string;
	description?: string;
	tone?: ToastTone;
	/** Duração em ms. Use null para notificação persistente. */
	duration?: number | null;
	action?: ToastAction;
}

interface ToastItem extends ToastInput {
	id: string;
}

interface ToastContextValue {
	toast: (input: ToastInput) => string;
	dismiss: (id: string) => void;
}

const MAX_TOASTS = 3;

const DEFAULT_DURATION: Record<ToastTone, number | null> = {
	success: 6000,
	info: 8000,
	warning: 8000,
	error: null,
};

const TONE_STYLES: Record<ToastTone, { container: string; icon: string; Icon: typeof Info }> = {
	success: {
		container: 'border-ok-bd bg-ok-bg text-ok-fg',
		icon: 'text-ok-fg',
		Icon: CheckCircle2,
	},
	info: {
		container: 'border-info-bd bg-info-bg text-info-fg',
		icon: 'text-info-fg',
		Icon: Info,
	},
	warning: {
		container: 'border-warn-bd bg-warn-bg text-warn-fg',
		icon: 'text-warn-fg',
		Icon: AlertTriangle,
	},
	error: {
		container: 'border-danger-bd bg-danger-bg text-danger-fg',
		icon: 'text-danger-fg',
		Icon: XCircle,
	},
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastCard({
	item,
	onDismiss,
}: {
	item: ToastItem;
	onDismiss: (id: string) => void;
}) {
	const tone = item.tone ?? 'info';
	const styles = TONE_STYLES[tone];
	const duration = item.duration === undefined ? DEFAULT_DURATION[tone] : item.duration;
	const [paused, setPaused] = useState(false);
	const remainingRef = useRef(duration);
	const startedAtRef = useRef(0);

	useEffect(() => {
		if (duration === null || paused) return;
		startedAtRef.current = Date.now();
		const timer = window.setTimeout(() => onDismiss(item.id), remainingRef.current ?? duration);
		return () => {
			window.clearTimeout(timer);
			if (remainingRef.current !== null) {
				remainingRef.current = Math.max(
					0,
					remainingRef.current - (Date.now() - startedAtRef.current)
				);
			}
		};
	}, [duration, paused, item.id, onDismiss]);

	const Icon = styles.Icon;

	return (
		<div
			role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
			className={`pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-4 shadow-xl ${styles.container}`}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocusCapture={() => setPaused(true)}
			onBlurCapture={() => setPaused(false)}
		>
			<Icon className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} aria-hidden="true" />
			<div className="min-w-0 flex-1">
				<p className="text-sm font-semibold leading-tight">{item.title}</p>
				{item.description && (
					<p className="mt-1 text-xs leading-snug opacity-90">{item.description}</p>
				)}
				{item.action && (
					<button
						type="button"
						onClick={() => {
							item.action?.onClick();
							onDismiss(item.id);
						}}
						className="mt-2 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
					>
						{item.action.label}
					</button>
				)}
			</div>
			<button
				type="button"
				onClick={() => onDismiss(item.id)}
				aria-label="Dispensar notificação"
				className="shrink-0 rounded-md p-1 text-current opacity-70 transition-opacity hover:opacity-100"
			>
				<X className="h-3.5 w-3.5" aria-hidden="true" />
			</button>
		</div>
	);
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<ToastItem[]>([]);
	const counterRef = useRef(0);

	const dismiss = useCallback((id: string) => {
		setItems((current) => current.filter((item) => item.id !== id));
	}, []);

	const toast = useCallback((input: ToastInput) => {
		counterRef.current += 1;
		const id = `toast-${Date.now()}-${counterRef.current}`;
		setItems((current) => [{ ...input, id }, ...current].slice(0, MAX_TOASTS));
		return id;
	}, []);

	const value = useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div
				aria-live="polite"
				aria-atomic="false"
				aria-label="Notificações"
				className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-2.5"
			>
				{items.map((item) => (
					<ToastCard key={item.id} item={item} onDismiss={dismiss} />
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastContextValue {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error('useToast deve ser usado dentro de ToastProvider.');
	}
	return context;
}
