import { z } from 'zod';

export const StyleSchema = z.object({
  fill: z.string().max(64),
  stroke: z.string().max(64),
  strokeWidth: z.number().min(0).max(64),
  opacity: z.number().min(0).max(1),
  roughness: z.number().min(0).max(3),
  dashed: z.boolean().optional(),
  fontSize: z.number().min(6).max(400).optional(),
});

export type ElementStyle = z.infer<typeof StyleSchema>;

export const BindingAnchorSchema = z.enum(['top', 'right', 'bottom', 'left', 'auto']);
export type BindingAnchor = z.infer<typeof BindingAnchorSchema>;

export const BindingSchema = z.object({
  elementId: z.string().min(1),
  anchor: BindingAnchorSchema,
});
export type ElementBinding = z.infer<typeof BindingSchema>;

export const PointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  pressure: z.number().min(0).max(1).optional(),
});
export type Point = z.infer<typeof PointSchema>;

const BaseElementSchema = z.object({
  id: z.string().min(1).max(128),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite(),
  height: z.number().finite(),
  rotation: z.number().finite(),
  zIndex: z.string().min(1).max(32),
  groupId: z.string().max(128).nullable().optional(),
  style: StyleSchema,
  locked: z.boolean(),
  updatedAt: z.number().int().nonnegative(),
});

export const RectangleElementSchema = BaseElementSchema.extend({ type: z.literal('rectangle') });
export const EllipseElementSchema = BaseElementSchema.extend({ type: z.literal('ellipse') });
export const FrameElementSchema = BaseElementSchema.extend({
  type: z.literal('frame'),
  name: z.string().max(200).optional(),
});
export const LineElementSchema = BaseElementSchema.extend({
  type: z.literal('line'),
  points: z.array(PointSchema).min(2).max(4096),
});
export const ArrowElementSchema = BaseElementSchema.extend({
  type: z.literal('arrow'),
  points: z.array(PointSchema).min(2).max(4096),
  startBinding: BindingSchema.nullable().optional(),
  endBinding: BindingSchema.nullable().optional(),
  elbowed: z.boolean().optional(),
});
export const FreehandElementSchema = BaseElementSchema.extend({
  type: z.literal('freehand'),
  points: z.array(PointSchema).min(1).max(8192),
  simulatePressure: z.boolean().optional(),
});
export const TextElementSchema = BaseElementSchema.extend({
  type: z.literal('text'),
  text: z.string().max(20_000),
  fontSize: z.number().min(6).max(400),
  align: z.enum(['left', 'center', 'right']).optional(),
});
export const StickyElementSchema = BaseElementSchema.extend({
  type: z.literal('sticky'),
  text: z.string().max(4000),
  tone: z.enum(['warm', 'cool', 'neutral']).optional(),
});
export const ImageElementSchema = BaseElementSchema.extend({
  type: z.literal('image'),
  // Remote S3 URLs are short; inline data URLs are a bounded offline fallback.
  src: z.string().max(900_000),
  assetId: z.string().max(128).nullable().optional(),
});
export const CodeElementSchema = BaseElementSchema.extend({
  type: z.literal('code'),
  text: z.string().max(20_000),
  language: z.string().max(32),
  title: z.string().max(120).optional(),
});

export const ElementSchema = z.discriminatedUnion('type', [
  RectangleElementSchema,
  EllipseElementSchema,
  FrameElementSchema,
  LineElementSchema,
  ArrowElementSchema,
  FreehandElementSchema,
  TextElementSchema,
  StickyElementSchema,
  ImageElementSchema,
  CodeElementSchema,
]);

export type CanvasElement = z.infer<typeof ElementSchema>;
export type ElementType = CanvasElement['type'];
export type RectangleElement = z.infer<typeof RectangleElementSchema>;
export type EllipseElement = z.infer<typeof EllipseElementSchema>;
export type FrameElement = z.infer<typeof FrameElementSchema>;
export type LineElement = z.infer<typeof LineElementSchema>;
export type ArrowElement = z.infer<typeof ArrowElementSchema>;
export type FreehandElement = z.infer<typeof FreehandElementSchema>;
export type TextElement = z.infer<typeof TextElementSchema>;
export type StickyElement = z.infer<typeof StickyElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type CodeElement = z.infer<typeof CodeElementSchema>;

export function isBindable(element: CanvasElement): boolean {
  return (
    element.type === 'rectangle' ||
    element.type === 'ellipse' ||
    element.type === 'frame' ||
    element.type === 'sticky' ||
    element.type === 'image' ||
    element.type === 'code'
  );
}

export function hasPoints(
  element: CanvasElement,
): element is LineElement | ArrowElement | FreehandElement {
  return element.type === 'line' || element.type === 'arrow' || element.type === 'freehand';
}

/** Validates an untrusted element coming from a WebSocket update before it enters the Y.Doc. */
export function parseElement(value: unknown): CanvasElement {
  return ElementSchema.parse(value);
}
