import { memo } from 'react';
import type { CanvasElement } from '@syncboard/shared';
import { CodeShape } from './CodeShape';
import { EllipseShape } from './EllipseShape';
import { ImageShape } from './ImageShape';
import { PathShape } from './PathShape';
import { RectangleShape } from './RectangleShape';
import { StickyShape } from './StickyShape';
import { TextShape } from './TextShape';
import type { ShapeProps } from './types';

export interface ShapeNodeProps extends ShapeProps<CanvasElement> {
  element: CanvasElement;
}

/** One dispatch point so each concrete shape can stay independently memoized. */
export const ShapeNode = memo(function ShapeNode({ element, ...props }: ShapeNodeProps) {
  switch (element.type) {
    case 'rectangle':
      return <RectangleShape {...props} element={element} />;
    case 'ellipse':
      return <EllipseShape {...props} element={element} />;
    case 'frame':
      return (
        <RectangleShape
          {...props}
          element={{
            ...element,
            type: 'rectangle',
            style: { ...element.style, fill: 'rgba(255,255,255,0.35)', dashed: true },
          }}
        />
      );
    case 'line':
    case 'arrow':
    case 'freehand':
      return <PathShape {...props} element={element} />;
    case 'text':
      return <TextShape {...props} element={element} />;
    case 'sticky':
      return <StickyShape {...props} element={element} />;
    case 'image':
      return <ImageShape {...props} element={element} />;
    case 'code':
      return <CodeShape {...props} element={element} />;
  }
});
