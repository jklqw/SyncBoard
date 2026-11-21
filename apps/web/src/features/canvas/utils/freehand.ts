import { getStroke } from 'perfect-freehand';
import type { Point } from '@syncboard/shared';

export function strokeToSvgPath(points: Point[], size: number): string {
  if (points.length === 0) return '';
  const outline = getStroke(
    points.map((point) => [point.x, point.y, point.pressure ?? 0.5]),
    {
      size: Math.max(1, size),
      thinning: 0.55,
      smoothing: 0.5,
      streamline: 0.45,
      simulatePressure: false,
      easing: (value) => value,
      last: true,
    },
  );
  if (outline.length === 0) return '';
  let path = '';
  for (let index = 0; index < outline.length; index += 1) {
    const point = outline[index];
    if (!point) continue;
    path += `${index === 0 ? 'M' : 'L'}${point[0]?.toFixed(2) ?? '0'} ${point[1]?.toFixed(2) ?? '0'} `;
  }
  return `${path}Z`;
}
