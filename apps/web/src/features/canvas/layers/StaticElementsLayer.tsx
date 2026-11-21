import { memo } from 'react';
import { Layer } from 'react-konva';
import type { CanvasElement } from '@syncboard/shared';
import { ShapeNode } from '../shapes';

interface StaticElementsLayerProps {
  elements: CanvasElement[];
  interactive: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onOpenEditor: (id: string) => void;
}

export const StaticElementsLayer = memo(function StaticElementsLayer({
  elements,
  interactive,
  onSelect,
  onOpenEditor,
}: StaticElementsLayerProps) {
  return (
    <Layer>
      {elements.map((element) => (
        <ShapeNode
          key={element.id}
          element={element}
          listening={interactive}
          onSelect={onSelect}
          onOpenEditor={onOpenEditor}
        />
      ))}
    </Layer>
  );
});
