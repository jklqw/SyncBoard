import { memo } from 'react';
import { Arrow, Group, Line, Path } from 'react-konva';
import type { ArrowElement, FreehandElement, LineElement } from '@syncboard/shared';
import { strokeToSvgPath } from '../utils/freehand';
import { SHAPE_PERFECT_DRAW, type ShapeProps } from './types';

function flatPoints(points: ReadonlyArray<{ x: number; y: number }>): number[] {
  const result: number[] = [];
  for (const point of points) result.push(point.x, point.y);
  return result;
}

export const PathShape = memo(function PathShape({
  element,
  listening = true,
  onSelect,
}: ShapeProps<LineElement | ArrowElement | FreehandElement>) {
  const handlers = {
    onClick: (event: { evt: MouseEvent }) => onSelect?.(element.id, event.evt.shiftKey),
    onTap: (event: { evt: Event }) => onSelect?.(element.id, 'shiftKey' in event.evt && event.evt.shiftKey === true),
  };

  if (element.type === 'freehand') {
    return (
      <Group
        id={`el-${element.id}`}
        x={element.x}
        y={element.y}
        width={Math.max(element.width, 1)}
        height={Math.max(element.height, 1)}
        rotation={element.rotation}
        opacity={element.style.opacity}
        listening={listening}
        {...handlers}
      >
        <Path
          data={strokeToSvgPath(element.points, element.style.strokeWidth * 1.6)}
          fill={element.style.stroke}
          stroke={element.style.stroke}
          strokeWidth={0.5}
          perfectDrawEnabled={SHAPE_PERFECT_DRAW}
          hitStrokeWidth={14}
        />
      </Group>
    );
  }

  const points = flatPoints(element.points);
  const common = {
    points,
    stroke: element.style.stroke,
    strokeWidth: element.style.strokeWidth,
    dash: element.style.dashed ? [8, 6] : [],
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
    perfectDrawEnabled: SHAPE_PERFECT_DRAW,
    hitStrokeWidth: 14,
  };

  return (
    <Group
      id={`el-${element.id}`}
      x={element.x}
      y={element.y}
      width={Math.max(element.width, 1)}
      height={Math.max(element.height, 1)}
      rotation={element.rotation}
      opacity={element.style.opacity}
      listening={listening}
      {...handlers}
    >
      {element.type === 'arrow' ? (
        <Arrow {...common} pointerLength={10} pointerWidth={9} fill={element.style.stroke} />
      ) : (
        <Line {...common} />
      )}
    </Group>
  );
});
