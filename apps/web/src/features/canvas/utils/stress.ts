import { LIMITS, type CanvasElement, type ElementStyle } from '@syncboard/shared';
import { createElement, newId } from './elementFactory';

const STRESS_STYLES: ElementStyle[] = [
  { fill: 'transparent', stroke: '#18181B', strokeWidth: 1, opacity: 1, roughness: 0 },
  { fill: 'transparent', stroke: '#6B8CAE', strokeWidth: 1, opacity: 1, roughness: 0 },
  { fill: 'transparent', stroke: '#5B8E7D', strokeWidth: 1, opacity: 1, roughness: 0 },
];

/** Dev-only generator used by ?stress=5000 and window.__syncboardStress. */
export function generateStressElements(count: number): CanvasElement[] {
  const total = Math.min(Math.max(1, count), LIMITS.MAX_ELEMENTS_PER_BOARD);
  const columns = Math.ceil(Math.sqrt(total));
  const result: CanvasElement[] = [];
  for (let index = 0; index < total; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const type = index % 3 === 0 ? 'ellipse' : index % 3 === 1 ? 'rectangle' : 'line';
    const element = createElement(type, {
      id: newId(),
      style: STRESS_STYLES[index % STRESS_STYLES.length] ?? STRESS_STYLES[0]!,
      start: { x: column * 90, y: row * 90 },
      zIndex: `stress-${index.toString().padStart(8, '0')}`,
    });
    if (element.type === 'rectangle' || element.type === 'ellipse') {
      result.push({ ...element, width: 52, height: 36 });
    } else if (element.type === 'line') {
      result.push({ ...element, points: [{ x: 0, y: 0 }, { x: 48, y: 30 }], width: 48, height: 30 });
    } else {
      result.push(element);
    }
  }
  return result;
}
