import { memo } from 'react';
import { Group, Text } from 'react-konva';
import type { TextElement } from '@syncboard/shared';
import { type ShapeProps } from './types';

export const TextShape = memo(function TextShape({
  element,
  listening = true,
  onSelect,
  onOpenEditor,
}: ShapeProps<TextElement>) {
  return (
    <Group
      id={`el-${element.id}`}
      x={element.x}
      y={element.y}
      width={Math.max(element.width, 20)}
      height={Math.max(element.height, element.fontSize)}
      rotation={element.rotation}
      opacity={element.style.opacity}
      listening={listening}
      onClick={(event) => onSelect?.(element.id, event.evt.shiftKey)}
      onTap={(event) => onSelect?.(element.id, event.evt.shiftKey)}
      onDblClick={() => onOpenEditor?.(element.id)}
      onDblTap={() => onOpenEditor?.(element.id)}
    >
      <Text
        text={element.text || ' '}
        width={Math.max(element.width, 20)}
        fontSize={element.fontSize}
        fontFamily="Inter, sans-serif"
        fill={element.style.stroke}
        align={element.align ?? 'left'}
        lineHeight={1.35}
        perfectDrawEnabled={false}
      />
    </Group>
  );
});
