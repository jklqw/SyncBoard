import { memo, useEffect, useState } from 'react';
import { Group, Image as KonvaImage, Rect } from 'react-konva';
import type { ImageElement } from '@syncboard/shared';
import { type ShapeProps } from './types';

function useLoadedImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const next = new window.Image();
    // No crossOrigin: MinIO/S3 URLs work without a CORS policy and inline
    // data URLs work everywhere. Canvas export draws through Konva's own path.
    next.onload = () => setImage(next);
    next.onerror = () => setImage(null);
    next.src = src;
    return () => {
      next.onload = null;
      next.onerror = null;
    };
  }, [src]);
  return image;
}

export const ImageShape = memo(function ImageShape({
  element,
  listening = true,
  onSelect,
}: ShapeProps<ImageElement>) {
  const image = useLoadedImage(element.src);
  const width = Math.max(Math.abs(element.width), 1);
  const height = Math.max(Math.abs(element.height), 1);
  return (
    <Group
      id={`el-${element.id}`}
      x={element.x}
      y={element.y}
      width={width}
      height={height}
      rotation={element.rotation}
      opacity={element.style.opacity}
      listening={listening}
      onClick={(event) => onSelect?.(element.id, event.evt.shiftKey)}
      onTap={(event) => onSelect?.(element.id, event.evt.shiftKey)}
    >
      {image ? (
        <KonvaImage image={image} width={width} height={height} perfectDrawEnabled={false} />
      ) : (
        <Rect width={width} height={height} fill="#ECEAE5" stroke="#A1A1AA" dash={[4, 4]} />
      )}
    </Group>
  );
});
