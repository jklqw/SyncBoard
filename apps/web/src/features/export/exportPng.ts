import type Konva from 'konva';
import { getElementBounds, type CanvasElement } from '@syncboard/shared';

export interface ExportOptions {
  elements: CanvasElement[];
  stage: Konva.Stage;
  pixelRatio?: number;
  filename?: string;
}

export function boundsForElements(elements: CanvasElement[], padding = 48) {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  }
  const first = getElementBounds(elements[0]!);
  const bounds = elements.slice(1).reduce(
    (acc, element) => {
      const next = getElementBounds(element);
      return {
        minX: Math.min(acc.minX, next.minX),
        minY: Math.min(acc.minY, next.minY),
        maxX: Math.max(acc.maxX, next.maxX),
        maxY: Math.max(acc.maxY, next.maxY),
      };
    },
    first,
  );
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  };
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

export function exportPng({
  elements,
  stage,
  pixelRatio = 2,
  filename = 'syncboard.png',
}: ExportOptions): string {
  const bounds = boundsForElements(elements);
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);

  const previous = {
    x: stage.x(),
    y: stage.y(),
    scaleX: stage.scaleX(),
    scaleY: stage.scaleY(),
  };

  stage.scale({ x: 1, y: 1 });
  stage.position({ x: -bounds.minX, y: -bounds.minY });
  stage.batchDraw();

  const dataUrl = stage.toDataURL({
    x: 0,
    y: 0,
    width,
    height,
    pixelRatio,
    mimeType: 'image/png',
  });

  stage.scale({ x: previous.scaleX, y: previous.scaleY });
  stage.position({ x: previous.x, y: previous.y });
  stage.batchDraw();

  downloadDataUrl(dataUrl, filename);
  return dataUrl;
}
