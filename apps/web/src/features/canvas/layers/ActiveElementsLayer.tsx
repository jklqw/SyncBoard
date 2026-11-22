import { memo, useEffect, useRef, type RefObject } from 'react';
import type Konva from 'konva';
import { Layer, Transformer } from 'react-konva';
import type { CanvasElement } from '@syncboard/shared';
import { ShapeNode } from '../shapes';

interface ActiveElementsLayerProps {
  elements: CanvasElement[];
  stageRef: RefObject<Konva.Stage | null>;
  draggable: boolean;
  interactive: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onOpenEditor: (id: string) => void;
  onTransformEnd: (id: string, attrs: TransformResult) => void;
}

export interface TransformResult {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

function readAttrs(node: Konva.Node): TransformResult {
  return {
    x: node.x(),
    y: node.y(),
    width: node.width(),
    height: node.height(),
    rotation: node.rotation(),
    scaleX: node.scaleX(),
    scaleY: node.scaleY(),
  };
}

export const ActiveElementsLayer = memo(function ActiveElementsLayer({
  elements,
  stageRef,
  draggable,
  interactive,
  onSelect,
  onOpenEditor,
  onTransformEnd,
}: ActiveElementsLayerProps) {
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const nodes = elements
      .map((element) => stage.findOne(`#el-${element.id}`))
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(nodes);

    for (const element of elements) {
      const node = stage.findOne(`#el-${element.id}`);
      if (!node) continue;
      node.draggable(draggable && !element.locked);
      node.off('dragend.syncboard');
      node.on('dragend.syncboard', () => {
        onTransformEnd(element.id, readAttrs(node));
      });
    }

    transformer.getLayer()?.batchDraw();
    return () => {
      for (const element of elements) {
        const node = stage.findOne(`#el-${element.id}`);
        node?.off('dragend.syncboard');
      }
    };
  }, [elements, stageRef, draggable, onTransformEnd]);

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
      <Transformer
        ref={transformerRef}
        rotateEnabled
        flipEnabled={false}
        keepRatio={false}
        ignoreStroke
        anchorSize={8}
        anchorStroke="#2563EB"
        anchorFill="#FFFFFF"
        anchorCornerRadius={2}
        borderStroke="#2563EB"
        borderStrokeWidth={1}
        boundBoxFunc={(oldBox, newBox) =>
          Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4 ? oldBox : newBox
        }
        onTransformEnd={() => {
          const stage = stageRef.current;
          if (!stage) return;
          for (const element of elements) {
            const node = stage.findOne(`#el-${element.id}`);
            if (!node) continue;
            onTransformEnd(element.id, readAttrs(node));
          }
        }}
      />
    </Layer>
  );
});
