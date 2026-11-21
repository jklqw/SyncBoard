import { memo, useMemo } from 'react';
import { Layer, Shape } from 'react-konva';
import { LIMITS } from '@syncboard/shared';
import { useUiStore } from '../../../stores/useUiStore';
import type { Camera } from '../../../stores/useViewportStore';

interface GridLayerProps {
  camera: Camera;
  width: number;
  height: number;
}

/** One batched canvas path for the whole dot field — no thousands of React nodes. */
export const GridLayer = memo(function GridLayer({ camera, width, height }: GridLayerProps) {
  const theme = useUiStore((state) => state.theme);
  const color = theme === 'dark' ? '#272930' : '#E4E2DD';

  const dots = useMemo(() => {
    let spacing = LIMITS.GRID_SIZE;
    while (spacing * camera.scale < 22) spacing *= 2;
    while (spacing * camera.scale > 66) spacing /= 2;

    const minX = (0 - camera.x) / camera.scale;
    const minY = (0 - camera.y) / camera.scale;
    const maxX = (width - camera.x) / camera.scale;
    const maxY = (height - camera.y) / camera.scale;
    const startX = Math.floor(minX / spacing) * spacing;
    const startY = Math.floor(minY / spacing) * spacing;
    const points: Array<[number, number]> = [];
    for (let x = startX; x <= maxX; x += spacing) {
      for (let y = startY; y <= maxY; y += spacing) points.push([x, y]);
    }
    return { points, radius: 1 / camera.scale };
  }, [camera.x, camera.y, camera.scale, width, height]);

  return (
    <Layer listening={false}>
      <Shape
        listening={false}
        perfectDrawEnabled={false}
        sceneFunc={(context) => {
          const raw = (context as unknown as { _context: CanvasRenderingContext2D })._context;
          raw.beginPath();
          for (const [x, y] of dots.points) {
            raw.moveTo(x + dots.radius, y);
            raw.arc(x, y, dots.radius, 0, Math.PI * 2);
          }
          raw.fillStyle = color;
          raw.fill();
        }}
      />
    </Layer>
  );
});
