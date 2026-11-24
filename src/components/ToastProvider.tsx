import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { apiClient, ApiNotification } from '../services/apiClient';
import { authService } from '../services/authService';

type ToastType = ApiNotification['type'];

interface ToastContextValue {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_TITLES: Record<ToastType, string> = {
  success: 'Sucesso',
  error: 'Erro',
  warning: 'Atenção',
  info: 'Informação',
};

const VARIANTS = {
  success: { icon: CheckCircle2, className: 'border-status-success-border bg-status-success-bg text-status-success-fg' },
  error: { icon: XCircle, className: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg' },
  warning: { icon: AlertTriangle, className: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg' },
  info: { icon: Info, className: 'border-status-info-border bg-status-info-bg text-status-info-fg' },
} as const;

/** Sucesso/info: 4s. Erro/aviso: 6s. */
const toastDuration = (type: ToastType) => (type === 'error' || type === 'warning' ? 6000 : 4000);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ApiNotification[]>([]);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const unsubscribe = apiClient.subscribeError((notification) => {
      // A sessão expirada (401) já é tratada em App.tsx, que encerra a sessão sem toast.
      if (notification.status === 401 && authService.getCurrentUser()) return;

      setToasts((previous) => [notification, ...previous.slice(0, 2)]);
      const timer = setTimeout(() => {
        setToasts((previous) => previous.filter((item) => item.id !== notification.id));
        timers.current.delete(timer);
      }, toastDuration(notification.type));
      timers.current.add(timer);
    });

    return () => {
      unsubscribe();
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((type: ToastType, message: string, title?: string) => {
    apiClient.notify({ type, title: title || DEFAULT_TITLES[type], message });
  }, []);

  const value = useMemo<ToastContextValue>(() => ({
    success: (message, title) => show('success', message, title),
    error: (message, title) => show('error', message, title),
    info: (message, title) => show('info', message, title),
  }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <aside
        aria-label="Notificações do Sistema"
        className="pointer-events-none fixed left-1/2 top-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2.5 sm:bottom-5 sm:left-auto sm:right-5 sm:top-auto sm:translate-x-0"
      >
        {toasts.map((toast) => {
          const variant = VARIANTS[toast.type];
          const Icon = variant.icon;
          const isError = toast.type === 'error' || toast.type === 'warning';

          return (
            <div
              key={toast.id}
              role={isError ? 'alert' : 'status'}
              aria-live={isError ? undefined : 'polite'}
              className={`toast-enter pointer-events-auto radius-lg border p-3.5 shadow-lg flex items-start justify-between gap-3 ${variant.className}`}
            >
              <div className="flex items-start gap-2.5">
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold leading-tight">{toast.title}</p>
                    {toast.status ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 radius-base bg-surface-card/70">
                        HTTP {toast.status}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] opacity-90 mt-1 leading-snug">{toast.message}</p>
                  <span className="text-[9px] opacity-60 block mt-1">{toast.timestamp}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 cursor-pointer p-1 radius-base hover:bg-surface-card/70"
                title="Fechar notificação"
                aria-label="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return context;
};
