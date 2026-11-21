import type { CanvasElement } from '../schemas/elements';
import { hasPoints } from '../schemas/elements';

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getElementBounds(element: CanvasElement): Rect {
  if (hasPoints(element)) {
    const xs = element.points.map((p) => p.x);
    const ys = element.points.map((p) => p.y);
    const minX = element.x + Math.min(0, ...xs);
    const minY = element.y + Math.min(0, ...ys);
    return {
      minX,
      minY,
      maxX: element.x + Math.max(0, ...xs),
      maxY: element.y + Math.max(0, ...ys),
    };
  }
  return {
    minX: element.x,
    minY: element.y,
    maxX: element.x + Math.max(Math.abs(element.width), 1),
    maxY: element.y + Math.max(Math.abs(element.height), 1),
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    outer.minX <= inner.minX &&
    outer.minY <= inner.minY &&
    outer.maxX >= inner.maxX &&
    outer.maxY >= inner.maxY
  );
}

export function unionBounds(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  return rects.reduce((acc, r) => ({
    minX: Math.min(acc.minX, r.minX),
    minY: Math.min(acc.minY, r.minY),
    maxX: Math.max(acc.maxX, r.maxX),
    maxY: Math.max(acc.maxY, r.maxY),
  }));
}

export function expandRect(rect: Rect, padding: number): Rect {
  return {
    minX: rect.minX - padding,
    minY: rect.minY - padding,
    maxX: rect.maxX + padding,
    maxY: rect.maxY + padding,
  };
}

/** Converts a viewport rectangle in screen coordinates into world coordinates. */
export function screenToWorldRect(
  screen: Rect,
  camera: { x: number; y: number; scale: number },
): Rect {
  return {
    minX: (screen.minX - camera.x) / camera.scale,
    minY: (screen.minY - camera.y) / camera.scale,
    maxX: (screen.maxX - camera.x) / camera.scale,
    maxY: (screen.maxY - camera.y) / camera.scale,
  };
}
