import React, { ReactNode, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
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

/**
 * Dropdown fechado com multisseleção: usa o mesmo campo dos demais filtros
 * (`field`, h-9, text-xs) e abre um painel com checkboxes ao clique. Fecha com
 * clique fora ou Esc (comportamento padrão do Popover).
 */
export const FilterMultiSelect: React.FC<FilterMultiSelectProps> = ({
  label,
  values,
  onChange,
  options,
}) => {
  const [open, setOpen] = useState(false);
  const allSelected = values.length === 0;
  const summary = allSelected
    ? 'Todos'
    : values.length === 1
      ? (options.find((opt) => opt.value === values[0])?.label ?? values[0])
      : `${values.length} setores`;

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };
  const itemClass = (selected: boolean) =>
    cn(
      'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-subtle focus-within:bg-surface-subtle',
      selected && 'bg-surface-subtle font-semibold',
    );
  const checkboxClass =
    'h-3.5 w-3.5 shrink-0 radius-base border border-border-subtle accent-brand-blue-action';

  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </label>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <select
            aria-label={label}
            value="current"
            onChange={() => {}}
            onMouseDown={(event) => event.preventDefault()}
            className="w-full h-9 text-xs field px-2.5 py-1.5"
          >
            <option value="current">{summary}</option>
          </select>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={4}
            avoidCollisions={false}
            style={{ width: 'var(--radix-popover-trigger-width)' }}
            onMouseDown={(event) => event.stopPropagation()}
            className="z-[60] overflow-hidden radius-lg border border-border-subtle bg-surface-card shadow-md outline-none"
          >
            <div
              role="listbox"
              aria-multiselectable="true"
              style={{ maxHeight: 'min(280px, calc(var(--radix-popper-available-height) - 4px))' }}
              className="overflow-y-auto py-1"
            >
              <label role="option" aria-selected={allSelected} className={itemClass(allSelected)}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onChange([])}
                  className={checkboxClass}
                />
                <span className="truncate">Todos</span>
              </label>
              {options.length === 0 ? (
                <p className="px-3 py-2 text-center text-[11px] text-text-muted">
                  Nenhuma opção encontrada.
                </p>
              ) : (
                options.map((opt) => {
                  const selected = values.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      role="option"
                      aria-selected={selected}
                      className={itemClass(selected)}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggle(opt.value)}
                        className={checkboxClass}
                      />
                      <span className="truncate">{opt.label}</span>
                    </label>
                  );
                })
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};
