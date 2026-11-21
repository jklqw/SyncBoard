import { memo } from 'react';
import { Ellipse, Group } from 'react-konva';
import type { EllipseElement } from '@syncboard/shared';
import { SHAPE_PERFECT_DRAW, type ShapeProps } from './types';

export const EllipseShape = memo(function EllipseShape({
  element,
  listening = true,
  onSelect,
  onOpenEditor,
}: ShapeProps<EllipseElement>) {
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
      onDblClick={() => onOpenEditor?.(element.id)}
      onDblTap={() => onOpenEditor?.(element.id)}
    >
      <Ellipse
        x={width / 2}
        y={height / 2}
        radiusX={width / 2}
        radiusY={height / 2}
        fill={element.style.fill}
        stroke={element.style.stroke}
        strokeWidth={element.style.strokeWidth}
        dash={element.style.dashed ? [8, 6] : []}
        perfectDrawEnabled={SHAPE_PERFECT_DRAW}
        hitStrokeWidth={12}
      />
    </Group>
  );
});
