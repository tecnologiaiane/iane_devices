import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	children: ReactNode;
	footer?: ReactNode;
	maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
	disableEscapeClose?: boolean;
	bodyClassName?: string;
}

const MAX_WIDTH: Record<NonNullable<ModalProps['maxWidth']>, string> = {
	sm: 'max-w-sm',
	md: 'max-w-md',
	lg: 'max-w-lg',
	xl: 'max-w-xl',
	'2xl': 'max-w-2xl',
	'4xl': 'max-w-4xl',
};

/**
 * Modal do Design System: usa o elemento nativo <dialog>, que já prende o foco,
 * fecha com Esc e devolve o foco ao elemento de origem.
 */
export function Modal({
	isOpen,
	onClose,
	title,
	subtitle,
	children,
	footer,
	maxWidth = 'xl',
	disableEscapeClose = false,
	bodyClassName,
}: ModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const titleId = useId();
	const descriptionId = useId();

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		if (isOpen) {
			if (!dialog.open) {
				previousFocusRef.current =
					document.activeElement instanceof HTMLElement ? document.activeElement : null;
				dialog.showModal();
			}
			document.body.style.overflow = 'hidden';
		} else {
			if (dialog.open) dialog.close();
			document.body.style.overflow = '';
		}
	}, [isOpen]);

	useEffect(
		() => () => {
			document.body.style.overflow = '';
			previousFocusRef.current?.focus?.();
		},
		[]
	);

	if (!isOpen) return null;

	const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
		if (event.target === event.currentTarget) onClose();
	};

	return (
		<dialog
			ref={dialogRef}
			data-slot="modal"
			aria-labelledby={titleId}
			aria-describedby={subtitle ? descriptionId : undefined}
			onCancel={(event) => {
				event.preventDefault();
				if (!disableEscapeClose) onClose();
			}}
			onClick={handleBackdropClick}
			className={twMerge(
				'm-auto w-[calc(100%-2rem)] overflow-hidden rounded-lg border border-line bg-surface p-0 text-text shadow-xl',
				'open:animate-[modal-in_200ms_ease-out]',
				MAX_WIDTH[maxWidth]
			)}
		>
			<div className="flex max-h-[calc(100dvh-2rem)] flex-col">
				<header className="flex items-start justify-between gap-4 border-b border-line bg-subtle/60 px-5 py-4">
					<div className="min-w-0">
						<h2 id={titleId} className="text-subtitle font-strong leading-snug text-text">
							{title}
						</h2>
						{subtitle && (
							<p id={descriptionId} className="mt-0.5 text-xs text-muted">
								{subtitle}
							</p>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Fechar"
						className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-subtle hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
					>
						<X className="h-4 w-4" aria-hidden="true" />
					</button>
				</header>

				<div className={twMerge('overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>

				{footer && (
					<footer className="flex items-center justify-end gap-2 border-t border-line bg-subtle/60 px-5 py-3">
						{footer}
					</footer>
				)}
			</div>
		</dialog>
	);
}
