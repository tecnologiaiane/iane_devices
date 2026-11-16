import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AccordionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  icon,
  defaultOpen = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className="radius-lg border border-border-subtle bg-surface-card shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-surface-subtle transition-colors border-b border-border-subtle"
        onClick={toggle}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="shrink-0">{icon}</span>}
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
        )}
      </div>

      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
};
