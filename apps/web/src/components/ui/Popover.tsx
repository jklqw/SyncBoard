import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from './cn';

export interface PopoverProps {
  trigger: ReactElement;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'start' | 'end' | 'center';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({
  trigger,
  children,
  align = 'start',
  className,
  open: controlledOpen,
  onOpenChange,
}: PopoverProps): ReactElement {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const rootRef = useRef<HTMLDivElement>(null);

  const setOpen = (next: boolean): void => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  });

  const triggerElement = trigger as ReactElement<{
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    'aria-expanded'?: boolean;
    'aria-haspopup'?: string;
  }>;

  return (
    <div ref={rootRef} className="relative inline-flex">
      {trigger}
      {open ? (
        <div
          role="dialog"
          className={cn(
            'sb-panel sb-fade-in absolute top-[calc(100%+6px)] z-50 min-w-[190px] p-1.5',
            align === 'start' && 'left-0',
            align === 'end' && 'right-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            className,
          )}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      ) : null}
      {typeof triggerElement.props === 'object' ? null : null}
    </div>
  );
}
