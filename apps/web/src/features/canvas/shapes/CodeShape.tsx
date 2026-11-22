import { memo, useMemo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { CodeElement } from '@syncboard/shared';
import { CODE_TOKEN_COLORS, tokenizeCode } from '../utils/codeHighlight';
import { type ShapeProps } from './types';

const FONT_SIZE = 12;
const LINE_HEIGHT = FONT_SIZE * 1.45;
const MONO_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

let measureContext: CanvasRenderingContext2D | null = null;

function tokenWidth(text: string): number {
  if (typeof document === 'undefined') return text.length * FONT_SIZE * 0.6;
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * FONT_SIZE * 0.6;
  measureContext.font = `${FONT_SIZE}px ${MONO_FAMILY}`;
  return measureContext.measureText(text).width;
}

export const CodeShape = memo(function CodeShape({
  element,
  listening = true,
  onSelect,
  onOpenEditor,
}: ShapeProps<CodeElement>) {
  const width = Math.max(element.width, 160);
  const height = Math.max(element.height, 120);
  const maxLines = Math.ceil((height - 44) / LINE_HEIGHT) + 1;
  const lines = useMemo(
    () => tokenizeCode(element.text, element.language).slice(0, maxLines),
    [element.text, element.language, maxLines],
  );

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
      <Group
        x={12}
        y={36}
        clipX={0}
        clipY={0}
        clipWidth={width - 24}
        clipHeight={height - 44}
        listening={false}
      >
        {lines.map((tokens, row) => {
          let offset = 0;
          return (
            <Group key={row} y={row * LINE_HEIGHT}>
              {tokens.map((token, column) => {
                const x = offset;
                offset += tokenWidth(token.text);
                return (
                  <Text
                    key={column}
                    x={x}
                    text={token.text}
                    fontSize={FONT_SIZE}
                    lineHeight={1.45}
                    fontFamily={MONO_FAMILY}
                    fill={CODE_TOKEN_COLORS[token.tone]}
                    wrap="none"
                    perfectDrawEnabled={false}
                  />
                );
              })}
            </Group>
          );
        })}
      </Group>
    </Group>
  );
});
