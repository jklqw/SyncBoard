import { useEffect, useMemo, useRef } from 'react';
import type { CanvasElement } from '@syncboard/shared';
import { worldToScreen } from './utils/geometry';
import { useViewportStore } from '../../stores/useViewportStore';

interface TextEditorOverlayProps {
  element: CanvasElement;
  onChange: (text: string) => void;
  onClose: () => void;
}

export function TextEditorOverlay({ element, onChange, onClose }: TextEditorOverlayProps) {
  const cameraX = useViewportStore((state) => state.x);
  const cameraY = useViewportStore((state) => state.y);
  const cameraScale = useViewportStore((state) => state.scale);
  const camera = useMemo(
    () => ({ x: cameraX, y: cameraY, scale: cameraScale }),
    [cameraX, cameraY, cameraScale],
  );
  const ref = useRef<HTMLTextAreaElement>(null);
  const screen = worldToScreen({ x: element.x, y: element.y }, camera);
  const isSticky = element.type === 'sticky';
  const fontSize =
    element.type === 'text'
      ? element.fontSize * camera.scale
      : Math.max(12, Math.min(18, (element.style.fontSize ?? 16) * camera.scale));
  const width = Math.max(element.width, isSticky ? 180 : 120) * camera.scale;
  const height = Math.max(element.height, isSticky ? 180 : fontSize * 1.4) * camera.scale;

  useEffect(() => {
    // The pointerup that follows the canvas click can steal focus from a
    // synchronously focused textarea; focus on the next tick so typing always
    // lands in the editor instead of triggering canvas shortcuts.
    const timer = window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 80);
    return () => window.clearTimeout(timer);
  }, []);

  if (element.type !== 'text' && element.type !== 'sticky') return null;

  const text = element.text;
  const background = isSticky
    ? element.tone === 'cool'
      ? '#DCE7EC'
      : element.tone === 'neutral'
        ? '#ECEAE5'
        : '#F5E9D2'
    : 'transparent';

  return (
    <textarea
      ref={ref}
      value={text}
      aria-label={isSticky ? 'Edit sticky note' : 'Edit text'}
      className="pointer-events-auto absolute z-30 resize-none overflow-hidden border-none outline-none"
      style={{
        left: screen.x,
        top: screen.y,
        width,
        height,
        fontSize,
        lineHeight: 1.35,
        fontFamily: 'Inter, sans-serif',
        color: isSticky ? '#3B3126' : element.style.stroke,
        background,
        padding: isSticky ? 12 * camera.scale : 0,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: 'top left',
        boxShadow: isSticky ? '0 1px 0 rgba(24,24,27,0.06)' : 'none',
      }}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onClose();
        }
      }}
    />
  );
}
