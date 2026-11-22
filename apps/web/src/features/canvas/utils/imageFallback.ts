export interface InlineImage {
  src: string;
  width: number;
  height: number;
}

/**
 * Last-resort image storage for environments without object storage (or when
 * an upload fails). The image is re-encoded to a bounded WebP data URL so it
 * still travels through the normal Yjs element sync and stays inside the
 * WebSocket frame limit.
 */
export async function fileToInlineImage(file: File): Promise<InlineImage> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1280;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable in this browser.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.82;
  let src = canvas.toDataURL('image/webp', quality);
  while (src.length > 700_000 && quality > 0.42) {
    quality -= 0.12;
    src = canvas.toDataURL('image/webp', quality);
  }
  if (src.length > 900_000) throw new Error('Image is too large to store on the board.');
  return { src, width, height };
}
