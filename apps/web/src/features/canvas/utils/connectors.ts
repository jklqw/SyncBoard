import {
  anchorPoint,
  computeConnectorEndpoints,
  computeElbowPoints,
  getElementBounds,
  isBindable,
  nearestAnchor,
  type ArrowElement,
  type BindingAnchor,
  type CanvasElement,
  type ElementBinding,
} from '@syncboard/shared';
import type { Point2D } from './geometry';

const SNAP_DISTANCE = 18;

function distanceToRect(point: Point2D, bounds: ReturnType<typeof getElementBounds>): number {
  const dx = Math.max(bounds.minX - point.x, 0, point.x - bounds.maxX);
  const dy = Math.max(bounds.minY - point.y, 0, point.y - bounds.maxY);
  return Math.hypot(dx, dy);
}

/** Snap a loose arrow endpoint to the closest shape edge within a screen-independent radius. */
export function snapEndpoint(
  point: Point2D,
  elements: CanvasElement[],
  excludeId: string,
  tolerance = SNAP_DISTANCE,
): { point: Point2D; binding: ElementBinding | null } {
  let best: { element: CanvasElement; distance: number } | null = null;
  for (const element of elements) {
    if (element.id === excludeId || !isBindable(element)) continue;
    const distance = distanceToRect(point, getElementBounds(element));
    if (distance <= tolerance && (!best || distance < best.distance)) best = { element, distance };
  }
  if (!best) return { point, binding: null };
  const bounds = getElementBounds(best.element);
  const anchor: BindingAnchor = nearestAnchor(bounds, point);
  return {
    point: anchorPoint(bounds, anchor, point),
    binding: { elementId: best.element.id, anchor },
  };
}

/** Recompute every arrow bound to any of the changed elements, inside one Yjs transaction. */
export function recomputeBoundArrows(
  elements: CanvasElement[],
  changedIds: ReadonlySet<string>,
): CanvasElement[] {
  if (changedIds.size === 0) return [];
  const byId = new Map(elements.map((element) => [element.id, element]));
  const updated: CanvasElement[] = [];

  for (const element of elements) {
    if (element.type !== 'arrow') continue;
    if (changedIds.has(element.id)) continue;
    const arrow = element as ArrowElement;
    const startBinding = arrow.startBinding ?? null;
    const endBinding = arrow.endBinding ?? null;
    if (!startBinding && !endBinding) continue;
    if (!startBinding || !endBinding) continue;
    if (!changedIds.has(startBinding.elementId) && !changedIds.has(endBinding.elementId)) continue;

    const startShape = byId.get(startBinding.elementId);
    const endShape = byId.get(endBinding.elementId);
    if (!startShape || !endShape) continue;

    const endpoints = computeConnectorEndpoints(
      getElementBounds(startShape),
      getElementBounds(endShape),
      startBinding.anchor,
      endBinding.anchor,
    );
    const points = arrow.elbowed
      ? computeElbowPoints(endpoints.start, endpoints.end)
      : [endpoints.start, endpoints.end];
    const relative = points.map((point) => ({
      x: point.x - endpoints.start.x,
      y: point.y - endpoints.start.y,
    }));

    updated.push({
      ...arrow,
      x: endpoints.start.x,
      y: endpoints.start.y,
      width: Math.abs(endpoints.end.x - endpoints.start.x),
      height: Math.abs(endpoints.end.y - endpoints.start.y),
      points: relative,
      updatedAt: Date.now(),
    });
  }
  return updated;
}
