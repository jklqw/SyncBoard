import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={cn(
        'sb-btn',
        variant !== 'secondary' && `sb-btn--${variant}`,
        size !== 'md' && `sb-btn--${size}`,
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="sb-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
