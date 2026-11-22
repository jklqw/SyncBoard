import { nanoid } from 'nanoid';
import type { CanvasElement, ElementStyle, ElementType } from '@syncboard/shared';
import type { Point2D } from './geometry';

export function newId(): string {
  return nanoid(14);
}

/** Timestamp-prefixed, lexicographically sortable key; reordering swaps with a neighbour. */
export function nextZIndex(elements: CanvasElement[]): string {
  const max = elements.reduce(
    (value, element) => (element.zIndex > value ? element.zIndex : value),
    '',
  );
  const stamp = Date.now().toString(36).padStart(9, '0');
  const suffix = nanoid(5);
  const candidate = `${stamp}${suffix}`;
  return candidate > max ? candidate : `${max}a`;
}

export interface NewElementOptions {
  id?: string;
  style: ElementStyle;
  start: Point2D;
  zIndex: string;
  text?: string;
  src?: string;
  assetId?: string | null;
  language?: string;
  title?: string;
}

export function createElement(type: ElementType, options: NewElementOptions): CanvasElement {
  const base = {
    id: options.id ?? newId(),
    x: options.start.x,
    y: options.start.y,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: options.zIndex,
    style: { ...options.style },
    locked: false,
    updatedAt: Date.now(),
  };

  switch (type) {
    case 'rectangle':
      return { ...base, type: 'rectangle' };
    case 'ellipse':
      return { ...base, type: 'ellipse' };
    case 'frame':
      return { ...base, type: 'frame', name: 'Frame' };
    case 'line':
      return {
        ...base,
        type: 'line',
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      };
    case 'arrow':
      return {
        ...base,
        type: 'arrow',
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      };
    case 'freehand':
      return { ...base, type: 'freehand', points: [{ x: 0, y: 0 }], simulatePressure: false };
    case 'text':
      return {
        ...base,
        type: 'text',
        width: 180,
        height: options.style.fontSize ?? 18,
        text: options.text ?? '',
        fontSize: options.style.fontSize ?? 18,
        align: 'left',
      };
    case 'sticky':
      return {
        ...base,
        type: 'sticky',
        width: 180,
        height: 180,
        text: options.text ?? '',
        tone: 'warm' as const,
      };
    case 'image':
      return {
        ...base,
        type: 'image',
        width: 240,
        height: 160,
        src: options.src ?? '',
        ...(options.assetId ? { assetId: options.assetId } : {}),
      };
    case 'code':
      return {
        ...base,
        type: 'code',
        width: 420,
        height: 260,
        text: options.text ?? '// Write code here',
        language: options.language ?? 'typescript',
        title: options.title ?? 'Snippet',
      };
  }
}

export function duplicateElement(
  element: CanvasElement,
  dx: number,
  dy: number,
  zIndex: string,
): CanvasElement {
  const copy = {
    ...element,
    id: newId(),
    x: element.x + dx,
    y: element.y + dy,
    zIndex,
    updatedAt: Date.now(),
  } as CanvasElement;
  if ('groupId' in copy && copy.groupId) copy.groupId = newId();
  return copy;
}
