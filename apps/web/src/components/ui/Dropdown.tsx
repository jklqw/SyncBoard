import type { ReactElement, ReactNode } from 'react';
import { Popover } from './Popover';
import { cn } from './cn';

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
}

export interface DropdownProps {
  trigger: ReactElement;
  items: DropdownItem[];
  align?: 'start' | 'end';
  heading?: string;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}

export function Dropdown({ trigger, items, align = 'end', heading, open, onOpenChange }: DropdownProps) {
  return (
    <Popover trigger={trigger} align={align} open={open} onOpenChange={onOpenChange}>
      {(close) => (
        <div role="menu" aria-label={heading}>
          {heading ? (
            <div className="sb-label px-2 pt-1.5 pb-1" role="presentation">
              {heading}
            </div>
          ) : null}
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]',
                'hover:bg-[var(--sb-hover)] disabled:opacity-40',
                item.danger && 'text-[var(--sb-danger)]',
              )}
              onClick={() => {
                item.onSelect();
                close();
              }}
            >
              {item.icon ? <span className="flex-none opacity-70">{item.icon}</span> : null}
              <span className="flex-1">{item.label}</span>
              {item.checked ? <span className="text-[var(--sb-accent)]" aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
