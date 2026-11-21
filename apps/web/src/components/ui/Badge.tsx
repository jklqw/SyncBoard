import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
}

export function Badge({ children, tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'sb-badge',
        tone === 'accent' && 'border-[var(--sb-accent)]/20 text-[var(--sb-accent)]',
        tone === 'success' && 'border-[var(--sb-success)]/25 text-[var(--sb-success)]',
        tone === 'warning' && 'border-[var(--sb-warning)]/25 text-[var(--sb-warning)]',
        tone === 'danger' && 'border-[var(--sb-danger)]/25 text-[var(--sb-danger)]',
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
