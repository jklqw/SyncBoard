import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import { cn } from './cn';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Used as the accessible name and, when present, the tooltip text. */
  label: string;
  icon: ReactNode;
  shortcut?: string;
  tooltip?: boolean;
  active?: boolean;
  small?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    shortcut,
    tooltip = true,
    active = false,
    small = false,
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active}
      data-active={active || undefined}
      className={cn('sb-icon-btn', small && 'sb-icon-btn--sm', className)}
      {...rest}
    >
      {icon}
    </button>
  );

  if (!tooltip) return button;
  return (
    <Tooltip label={label} shortcut={shortcut}>
      {button}
    </Tooltip>
  );
});
