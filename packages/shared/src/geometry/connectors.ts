import type { BindingAnchor, Point } from '../schemas/elements';
import type { Rect } from './bounds';

export function rectCenter(rect: Rect): Point {
  return { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 };
}

/** Picks the closest side of a rectangle to a target point. */
export function nearestAnchor(rect: Rect, target: Point): Exclude<BindingAnchor, 'auto'> {
  const center = rectCenter(rect);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const halfW = Math.max((rect.maxX - rect.minX) / 2, 1);
  const halfH = Math.max((rect.maxY - rect.minY) / 2, 1);
  if (Math.abs(dx) / halfW > Math.abs(dy) / halfH) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

/** Computes the point where the line center->target crosses the requested anchor side. */
export function anchorPoint(rect: Rect, anchor: BindingAnchor, target: Point): Point {
  const center = rectCenter(rect);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const resolved: Exclude<BindingAnchor, 'auto'> =
    anchor === 'auto' ? nearestAnchor(rect, target) : anchor;

  switch (resolved) {
    case 'left': {
      const ratio = Math.abs(dx) > 1e-6 ? (rect.minX - center.x) / dx : 0;
      return { x: rect.minX, y: clamp(center.y + dy * ratio, rect.minY, rect.maxY) };
    }
    case 'right': {
      const ratio = Math.abs(dx) > 1e-6 ? (rect.maxX - center.x) / dx : 0;
      return { x: rect.maxX, y: clamp(center.y + dy * ratio, rect.minY, rect.maxY) };
    }
    case 'top': {
      const ratio = Math.abs(dy) > 1e-6 ? (rect.minY - center.y) / dy : 0;
      return { x: clamp(center.x + dx * ratio, rect.minX, rect.maxX), y: rect.minY };
    }
    case 'bottom': {
      const ratio = Math.abs(dy) > 1e-6 ? (rect.maxY - center.y) / dy : 0;
      return { x: clamp(center.x + dx * ratio, rect.minX, rect.maxX), y: rect.maxY };
    }
  }
}

/** Endpoints of a bound arrow, derived from both shapes' current bounds. */
export function computeConnectorEndpoints(
  start: Rect,
  end: Rect,
  startAnchor: BindingAnchor = 'auto',
  endAnchor: BindingAnchor = 'auto',
): { start: Point; end: Point } {
  const startCenter = rectCenter(start);
  const endCenter = rectCenter(end);
  return {
    start: anchorPoint(start, startAnchor, endCenter),
    end: anchorPoint(end, endAnchor, startCenter),
  };
}

/** Orthogonal elbow route with a mid-way bend chosen by the dominant axis. */
export function computeElbowPoints(from: Point, to: Point): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    const midX = from.x + dx / 2;
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
  }
  const midY = from.y + dy / 2;
  return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
