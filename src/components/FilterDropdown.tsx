import React, { ReactNode, useCallback, useRef, useState } from 'react';
import { Filter as FilterIcon, X } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';

interface FilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  activeCount: number;
  children: ReactNode;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  isOpen,
  onClose,
  activeCount,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed z-50 mt-1 w-80 overflow-hidden radius-lg border border-border-subtle bg-surface-card shadow-xl"
      style={{
        // Posicionado via JavaScript pelo componente pai para evitar sobreposição no card
      }}
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
            onClick={onClose}
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
        className="inline-flex items-center gap-2 radius-base border border-border-subtle bg-surface-card px-2.5 py-1.5 text-text-muted font-medium text-xs focus:outline-none focus:border-brand-blue-action focus:ring-2 focus:ring-brand-blue-action/15 hover:bg-surface-subtle transition-colors"
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
