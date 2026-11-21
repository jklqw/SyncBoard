export interface ShapeProps<T> {
  element: T;
  listening?: boolean;
  onSelect?: (id: string, additive: boolean) => void;
  onOpenEditor?: (id: string) => void;
}

export const SHAPE_PERFECT_DRAW = false as const;
