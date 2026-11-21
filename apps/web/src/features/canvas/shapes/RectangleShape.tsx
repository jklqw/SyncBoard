import { memo } from 'react';
import { Group, Rect } from 'react-konva';
import type { RectangleElement } from '@syncboard/shared';
import { SHAPE_PERFECT_DRAW, type ShapeProps } from './types';

export const RectangleShape = memo(function RectangleShape({
  element,
  listening = true,
  onSelect,
  onOpenEditor,
}: ShapeProps<RectangleElement>) {
  return (
    <Group
      id={`el-${element.id}`}
      x={element.x}
      y={element.y}
      width={Math.max(Math.abs(element.width), 1)}
      height={Math.max(Math.abs(element.height), 1)}
      rotation={element.rotation}
      opacity={element.style.opacity}
      listening={listening}
      onClick={(event) => onSelect?.(element.id, event.evt.shiftKey)}
      onTap={(event) => onSelect?.(element.id, event.evt.shiftKey)}
      onDblClick={() => onOpenEditor?.(element.id)}
      onDblTap={() => onOpenEditor?.(element.id)}
    >
      <Rect
        width={Math.max(Math.abs(element.width), 1)}
        height={Math.max(Math.abs(element.height), 1)}
        fill={element.style.fill}
        stroke={element.style.stroke}
        strokeWidth={element.style.strokeWidth}
        dash={element.style.dashed ? [8, 6] : []}
        cornerRadius={2}
        perfectDrawEnabled={SHAPE_PERFECT_DRAW}
        hitStrokeWidth={12}
      />
    </Group>
  );
});
