import { memo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { StickyElement } from '@syncboard/shared';
import { type ShapeProps } from './types';

const TONES: Record<'warm' | 'cool' | 'neutral', { fill: string; text: string }> = {
  warm: { fill: '#F5E9D2', text: '#3B3126' },
  cool: { fill: '#DCE7EC', text: '#26343B' },
  neutral: { fill: '#ECEAE5', text: '#2B2A27' },
};

export const StickyShape = memo(function StickyShape({
  element,
  listening = true,
  onSelect,
  onOpenEditor,
}: ShapeProps<StickyElement>) {
  const tone = TONES[element.tone ?? 'warm'] ?? TONES.warm;
  const width = Math.max(element.width, 40);
  const height = Math.max(element.height, 40);
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
      <Rect width={width} height={height} fill={tone.fill} stroke="rgba(24,24,27,0.10)" strokeWidth={1} />
      <Text
        text={element.text || 'Double-click to edit'}
        x={12}
        y={12}
        width={Math.max(width - 24, 16)}
        height={Math.max(height - 24, 16)}
        fontSize={Math.max(12, Math.min(18, element.style.fontSize ?? 16))}
        fontFamily="Inter, sans-serif"
        lineHeight={1.35}
        fill={tone.text}
        ellipsis
        wrap="word"
        perfectDrawEnabled={false}
      />
    </Group>
  );
});
