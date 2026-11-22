import { memo } from 'react';
import { Group, Layer, Line, Rect, Text } from 'react-konva';
import { getElementBounds, type CanvasElement, type Rect as Bounds } from '@syncboard/shared';
import type { CursorState, PeerState } from '../../collab/types';

interface OverlayLayerProps {
  marquee: Bounds | null;
  guides: Array<{ axis: 'x' | 'y'; value: number; from: number; to: number }>;
  peers: PeerState[];
  remoteCursors: Map<number, CursorState>;
  elements: CanvasElement[];
  scale: number;
}

export const OverlayLayer = memo(function OverlayLayer({
  marquee,
  guides,
  peers,
  remoteCursors,
  elements,
  scale,
}: OverlayLayerProps) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const inverse = 1 / Math.max(scale, 0.01);

  return (
    <Layer listening={false}>
      {marquee ? (
        <Rect
          x={marquee.minX}
          y={marquee.minY}
          width={marquee.maxX - marquee.minX}
          height={marquee.maxY - marquee.minY}
          fill="rgba(37,99,235,0.07)"
          stroke="#2563EB"
          strokeWidth={1 * inverse}
          dash={[4 * inverse, 3 * inverse]}
        />
      ) : null}

      {guides.map((guide, index) =>
        guide.axis === 'x' ? (
          <Line
            key={`gx-${index}`}
            points={[guide.value, guide.from, guide.value, guide.to]}
            stroke="#2563EB"
            strokeWidth={1 * inverse}
            dash={[3 * inverse, 3 * inverse]}
            opacity={0.6}
          />
        ) : (
          <Line
            key={`gy-${index}`}
            points={[guide.from, guide.value, guide.to, guide.value]}
            stroke="#2563EB"
            strokeWidth={1 * inverse}
            dash={[3 * inverse, 3 * inverse]}
            opacity={0.6}
          />
        ),
      )}

      {peers.flatMap((peer) =>
        peer.watching || peer.role === 'VIEWER'
          ? []
          : peer.selection.map((id) => {
              const element = byId.get(id);
              if (!element) return null;
              const bounds = getElementBounds(element);
              return (
                <Rect
                  key={`sel-${peer.clientId}-${id}`}
                  x={bounds.minX - 4 * inverse}
                  y={bounds.minY - 4 * inverse}
                  width={bounds.maxX - bounds.minX + 8 * inverse}
                  height={bounds.maxY - bounds.minY + 8 * inverse}
                  stroke={peer.user?.color ?? '#6B8CAE'}
                  strokeWidth={1.5 * inverse}
                  dash={[5 * inverse, 4 * inverse]}
                />
              );
            }),
      )}

      {peers.flatMap((peer) => {
        if (peer.watching || peer.role === 'VIEWER') return [];
        const cursor = remoteCursors.get(peer.clientId);
        if (!cursor) return null;
        const name = peer.user?.name ?? 'Collaborator';
        return (
          <Group
            key={`cursor-${peer.clientId}`}
            x={cursor.x}
            y={cursor.y}
            scaleX={inverse}
            scaleY={inverse}
          >
            <Line
              points={[0, 0, 0, 19, 4.5, 14, 7.5, 21, 10.5, 19.5, 7.5, 13, 13, 12]}
              closed
              fill={peer.user?.color ?? '#6B8CAE'}
              stroke="#FFFFFF"
              strokeWidth={1}
            />
            <Rect
              x={12}
              y={19}
              width={Math.max(28, name.length * 6.2 + 12)}
              height={20}
              cornerRadius={5}
              fill={peer.user?.color ?? '#6B8CAE'}
            />
            <Text
              x={17}
              y={23}
              text={name}
              fontSize={11}
              fontFamily="Inter, sans-serif"
              fill="#FFFFFF"
            />
          </Group>
        );
      })}
    </Layer>
  );
});
