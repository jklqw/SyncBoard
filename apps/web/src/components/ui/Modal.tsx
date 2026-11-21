import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    panelRef.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="sb-scrim" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('sb-panel sb-fade-in w-full p-5', 'max-h-[86vh] overflow-y-auto sb-scroll')}
        style={{ maxWidth: width }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.01em]">
              {title}
            </h2>
            {description ? <p className="sb-hint mt-1">{description}</p> : null}
          </div>
          <button type="button" className="sb-icon-btn sb-icon-btn--sm" aria-label="Close dialog" onClick={onClose}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-5 flex items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
