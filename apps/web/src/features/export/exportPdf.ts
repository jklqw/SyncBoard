import { jsPDF } from 'jspdf';
import type Konva from 'konva';
import type { CanvasElement } from '@syncboard/shared';
import { boundsForElements } from './exportPng';

export async function exportPdf(
  elements: CanvasElement[],
  stage: Konva.Stage,
  filename = 'syncboard.pdf',
): Promise<void> {
  const bounds = boundsForElements(elements);
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);

  const clone = stage.clone({ listening: false });
  clone.position({ x: -bounds.minX, y: -bounds.minY });
  clone.scale({ x: 1, y: 1 });
  clone.size({ width, height });
  const dataUrl = clone.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
  clone.destroy();

  const orientation = width >= height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: [width, height] });
  pdf.setFillColor(250, 249, 246);
  pdf.rect(0, 0, width, height, 'F');
  pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
  pdf.save(filename);
}
