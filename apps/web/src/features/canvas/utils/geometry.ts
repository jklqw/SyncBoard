import { getElementBounds, rectsIntersect, type CanvasElement, type Rect } from '@syncboard/shared';
import type { Camera } from '../../../stores/useViewportStore';

export interface Point2D {
  x: number;
  y: number;
}

export function screenToWorld(point: Point2D, camera: Camera): Point2D {
  return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale };
}

export function worldToScreen(point: Point2D, camera: Camera): Point2D {
  return { x: point.x * camera.scale + camera.x, y: point.y * camera.scale + camera.y };
}

export function normalizeRect(a: Point2D, b: Point2D): Rect {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

export function elementBoundsWithRotation(element: CanvasElement): Rect {
  // Bound arrows and guides use the axis-aligned bounds; rotation is visual only here.
  return getElementBounds(element);
}

export function elementsIntersect(rect: Rect, elements: CanvasElement[]): string[] {
  return elements.filter((element) => rectsIntersect(rect, getElementBounds(element))).map((element) => element.id);
}

export function selectionBounds(elements: CanvasElement[]): Rect | null {
  if (elements.length === 0) return null;
  return elements.reduce<Rect | null>((acc, element) => {
    const bounds = getElementBounds(element);
    if (!acc) return bounds;
    return {
      minX: Math.min(acc.minX, bounds.minX),
      minY: Math.min(acc.minY, bounds.minY),
      maxX: Math.max(acc.maxX, bounds.maxX),
      maxY: Math.max(acc.maxY, bounds.maxY),
    };
  }, null);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
