import React, { ReactNode } from 'react';
import { Filter as FilterIcon, X } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';
import { cn } from '../lib/utils';

interface FilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onClear?: () => void;
  activeCount: number;
  position?: { top: number; left: number } | null;
  children: ReactNode;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  isOpen,
  onClose,
  onClear,
  activeCount,
  position,
  children,
}) => {
  if (!isOpen || !position) return null;

  return (
    <div
      data-slot="filter-dropdown"
      className={cn(
        'fixed z-50 mt-1 w-80 overflow-hidden radius-lg border border-border-subtle bg-surface-card shadow-xl',
      )}
      style={{ top: position.top, left: position.left }}
      // O painel é renderizado fora do botão âncora; sem isso, o mousedown nos
      // selects chega ao listener de "clique fora" da tela e fecha o dropdown
      // antes de registrar a seleção.
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="px-3 py-2 space-y-3 border-b border-border-subtle pb-2">
        {children}
      </div>
      <div className="px-3 py-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClear?.();
              onClose();
            }}
            className="text-status-danger-fg hover:text-status-danger-fg/80"
          >
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
};

interface FilterTriggerProps {
  isOpen: boolean;
  activeCount: number;
  onToggle: () => void;
  label?: string;
}

export const FilterTrigger = React.forwardRef<HTMLButtonElement, FilterTriggerProps>(
  ({ isOpen, activeCount, onToggle, label = 'Filtros' }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          'inline-flex items-center gap-2 radius-base border border-border-subtle bg-surface-card px-2.5 py-1.5 text-text-muted font-medium text-xs',
          'focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 hover:bg-surface-subtle transition-colors',
        )}
      >
        <FilterIcon className="w-3.5 h-3.5 text-text-muted" />
        <span>{label}</span>
        {activeCount > 0 && (
          <Badge variant="info" size="sm" className="text-[10px]">
            {activeCount} ativos
          </Badge>
        )}
        {isOpen && <X className="w-3.5 h-3.5 text-text-muted" />}
      </button>
    );
  }
);

interface FilterFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

export const FilterField: React.FC<FilterFieldProps> = ({
  label,
  value,
  onChange,
  options,
}) => {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 text-xs field px-2.5 py-1.5"
      >
        <option value="todos">Todos</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

interface FilterMultiSelectProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: { label: string; value: string }[];
}

/** Multisseleção usada dentro do mesmo painel FilterDropdown, com a mesma linguagem visual de FilterField. */
export const FilterMultiSelect: React.FC<FilterMultiSelectProps> = ({
  label,
  values,
  onChange,
  options,
}) => {
  const toggle = (value: string, checked: boolean) => {
    onChange(checked ? [...values, value] : values.filter((item) => item !== value));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </label>
        {values.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] font-medium text-brand-blue-action hover:underline"
          >
            Limpar
          </button>
        )}
      </div>
      <div className="max-h-32 overflow-y-auto radius-base border border-border-subtle bg-surface-card px-2.5 py-1.5">
        {options.length === 0 ? (
          <p className="text-[11px] text-text-muted">Nenhuma opção encontrada.</p>
        ) : (
          <div className="space-y-1">
            {options.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-xs text-text-primary">
                <input
                  type="checkbox"
                  checked={values.includes(opt.value)}
                  onChange={(event) => toggle(opt.value, event.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--color-brand-blue-action)]"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <p className="text-[10px] text-text-muted">
        {values.length > 0 ? `${values.length} selecionado(s)` : 'Todos'}
      </p>
    </div>
  );
};
