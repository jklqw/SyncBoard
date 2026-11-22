import { memo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { CodeElement } from '@syncboard/shared';
import { type ShapeProps } from './types';

export const CodeShape = memo(function CodeShape({
  element,
  listening = true,
  onSelect,
  onOpenEditor,
}: ShapeProps<CodeElement>) {
  const width = Math.max(element.width, 160);
  const height = Math.max(element.height, 120);
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
      <Rect
        width={width}
        height={height}
        cornerRadius={6}
        fill="#18181B"
        stroke="#3F3F46"
        strokeWidth={1}
      />
      <Rect width={width} height={28} cornerRadius={[6, 6, 0, 0]} fill="#27272A" />
      <Text
        x={10}
        y={9}
        width={width - 100}
        text={element.title || 'Snippet'}
        fontSize={11}
        fontFamily="Inter, sans-serif"
        fill="#E4E4E7"
        ellipsis
        wrap="none"
        perfectDrawEnabled={false}
      />
      <Text
        x={width - 82}
        y={9}
        width={72}
        align="right"
        text={element.language}
        fontSize={10}
        fontFamily="Inter, sans-serif"
        fill="#A1A1AA"
        ellipsis
        wrap="none"
        perfectDrawEnabled={false}
      />
      <Text
        x={12}
        y={38}
        width={width - 24}
        height={height - 46}
        text={element.text || ' '}
        fontSize={12}
        lineHeight={1.45}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        fill="#D4D4D8"
        wrap="word"
        ellipsis
        perfectDrawEnabled={false}
      />
    </Group>
  );
});
