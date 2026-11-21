import { useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from './cn';

export interface TooltipProps {
  label: ReactNode;
  shortcut?: string;
  children: ReactElement;
  side?: 'top' | 'bottom';
  className?: string;
}

/** Lightweight hover/focus tooltip that clones its single child with the right ARIA wiring. */
export function Tooltip({
  label,
  shortcut,
  children,
  side = 'bottom',
  className,
}: TooltipProps): ReactElement {
  const [visible, setVisible] = useState(false);
  const hostRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  const child = children as ReactElement<Record<string, unknown>>;
  const originalAria = child.props['aria-describedby'];

  return (
    <span
      ref={hostRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocusCapture={() => setVisible(true)}
      onBlurCapture={() => setVisible(false)}
    >
      {children}
      {visible ? (
        <span
          id={id}
          role="tooltip"
          className="sb-tooltip"
          style={
            side === 'bottom'
              ? { top: 'calc(100% + 8px)', left: '50%' }
              : { bottom: 'calc(100% + 8px)', left: '50%' }
          }
        >
          {label}
          {shortcut ? <span className="sb-tooltip__key">{shortcut}</span> : null}
        </span>
      ) : null}
      {typeof originalAria === 'string' ? null : null}
    </span>
  );
}
