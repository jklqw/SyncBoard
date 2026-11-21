import type { ArrowElement, CanvasElement, FreehandElement, LineElement } from '@syncboard/shared';
import { strokeToSvgPath } from '../canvas/utils/freehand';
import { boundsForElements } from './exportPng';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function styleAttrs(element: CanvasElement): string {
  const { fill, stroke, strokeWidth, opacity, dashed } = element.style;
  const dash = dashed ? ` stroke-dasharray="8 6"` : '';
  return `fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" opacity="${opacity}"${dash}`;
}

function serializeElement(element: CanvasElement): string {
  const transform = `transform="translate(${element.x} ${element.y}) rotate(${element.rotation})"`;
  switch (element.type) {
    case 'rectangle':
    case 'frame':
      return `<rect ${transform} width="${Math.abs(element.width)}" height="${Math.abs(element.height)}" rx="2" ${styleAttrs(element)} />`;
    case 'ellipse':
      return `<ellipse ${transform} cx="${Math.abs(element.width) / 2}" cy="${Math.abs(element.height) / 2}" rx="${Math.abs(element.width) / 2}" ry="${Math.abs(element.height) / 2}" ${styleAttrs(element)} />`;
    case 'line':
    case 'arrow': {
      const path = element as LineElement | ArrowElement;
      const points = path.points.map((point) => `${point.x},${point.y}`).join(' ');
      const marker = element.type === 'arrow' ? ' marker-end="url(#arrowhead)"' : '';
      return `<polyline ${transform} points="${points}" fill="none" stroke="${escapeXml(element.style.stroke)}" stroke-width="${element.style.strokeWidth}" opacity="${element.style.opacity}" stroke-linecap="round" stroke-linejoin="round"${element.style.dashed ? ' stroke-dasharray="8 6"' : ''}${marker} />`;
    }
    case 'freehand': {
      const path = element as FreehandElement;
      const data = strokeToSvgPath(path.points, element.style.strokeWidth * 1.6);
      return `<path ${transform} d="${escapeXml(data)}" fill="${escapeXml(element.style.stroke)}" stroke="${escapeXml(element.style.stroke)}" stroke-width="0.5" opacity="${element.style.opacity}" />`;
    }
    case 'text':
      return `<text ${transform} font-family="Inter, sans-serif" font-size="${element.fontSize}" fill="${escapeXml(element.style.stroke)}" opacity="${element.style.opacity}">${escapeXml(element.text)}</text>`;
    case 'sticky': {
      const fill = element.tone === 'cool' ? '#DCE7EC' : element.tone === 'neutral' ? '#ECEAE5' : '#F5E9D2';
      return `<g ${transform}><rect width="${element.width}" height="${element.height}" fill="${fill}" stroke="rgba(24,24,27,0.1)" /><text x="12" y="28" font-family="Inter, sans-serif" font-size="16" fill="#3B3126">${escapeXml(element.text)}</text></g>`;
    }
    case 'image':
      return `<image ${transform} href="${escapeXml(element.src)}" width="${Math.abs(element.width)}" height="${Math.abs(element.height)}" opacity="${element.style.opacity}" />`;
  }
}

export function buildSvgMarkup(elements: CanvasElement[], background = '#FAF9F6'): string {
  const bounds = boundsForElements(elements);
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const sorted = [...elements].sort((a, b) => a.zIndex.localeCompare(b.zIndex));
  const body = sorted.map(serializeElement).join('\n  ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${bounds.minX} ${bounds.minY} ${width} ${height}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#18181B" />
    </marker>
  </defs>
  <rect x="${bounds.minX}" y="${bounds.minY}" width="${width}" height="${height}" fill="${background}" />
  ${body}
</svg>`;
}

export function exportSvg(elements: CanvasElement[], filename = 'syncboard.svg'): string {
  const markup = buildSvgMarkup(elements);
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}
