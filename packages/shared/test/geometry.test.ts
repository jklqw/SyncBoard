import { describe, expect, it } from 'vitest';
import {
  anchorPoint,
  computeConnectorEndpoints,
  computeElbowPoints,
  nearestAnchor,
  rectCenter,
  screenToWorldRect,
  getElementBounds,
  rectsIntersect,
  unionBounds,
} from '../src/index';
import type { Rect } from '../src/index';

const box: Rect = { minX: 0, minY: 0, maxX: 100, maxY: 40 };

describe('geometry helpers', () => {
  it('computes bounds for shapes and point-based elements', () => {
    expect(getElementBounds({
      id: 'r1', type: 'rectangle', x: 10, y: 20, width: 30, height: 15, rotation: 0,
      zIndex: 'a', style: { fill: '#fff', stroke: '#000', strokeWidth: 1, opacity: 1, roughness: 0 },
      locked: false, updatedAt: 1,
    })).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 35 });

    expect(getElementBounds({
      id: 'p1', type: 'line', x: 50, y: 50, width: 0, height: 0, rotation: 0,
      zIndex: 'a', style: { fill: 'none', stroke: '#000', strokeWidth: 1, opacity: 1, roughness: 0 },
      locked: false, updatedAt: 1, points: [{ x: 0, y: 0 }, { x: -20, y: 10 }],
    })).toEqual({ minX: 30, minY: 50, maxX: 50, maxY: 60 });
  });

  it('detects intersections and unions rectangles', () => {
    const other: Rect = { minX: 90, minY: 20, maxX: 120, maxY: 60 };
    expect(rectsIntersect(box, other)).toBe(true);
    expect(rectsIntersect(box, { minX: 200, minY: 200, maxX: 300, maxY: 300 })).toBe(false);
    expect(unionBounds([box, other])).toEqual({ minX: 0, minY: 0, maxX: 120, maxY: 60 });
    expect(unionBounds([])).toBeNull();
  });

  it('maps screen rects into world coordinates', () => {
    expect(screenToWorldRect(
      { minX: 100, minY: 50, maxX: 300, maxY: 250 },
      { x: 100, y: 50, scale: 2 },
    )).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
  });

  it('chooses the closest anchor and returns a point on that side', () => {
    expect(rectCenter(box)).toEqual({ x: 50, y: 20 });
    expect(nearestAnchor(box, { x: 200, y: 20 })).toBe('right');
    expect(nearestAnchor(box, { x: 50, y: -50 })).toBe('top');
    expect(anchorPoint(box, 'left', { x: -10, y: 20 })).toEqual({ x: 0, y: 20 });
    expect(anchorPoint(box, 'bottom', { x: 50, y: 100 })).toEqual({ x: 50, y: 40 });
  });

  it('derives connector endpoints from both shapes', () => {
    const far: Rect = { minX: 300, minY: 0, maxX: 400, maxY: 40 };
    const result = computeConnectorEndpoints(box, far);
    expect(result.start.x).toBe(100);
    expect(result.end.x).toBe(300);
  });

  it('routes orthogonal elbows', () => {
    const route = computeElbowPoints({ x: 0, y: 0 }, { x: 100, y: 20 });
    expect(route).toHaveLength(4);
    expect(route[1]).toEqual({ x: 50, y: 0 });
    expect(route[2]).toEqual({ x: 50, y: 20 });
  });
});
