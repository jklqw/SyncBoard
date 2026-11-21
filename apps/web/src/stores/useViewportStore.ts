import { create } from 'zustand';
import { LIMITS, type Rect } from '@syncboard/shared';

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

interface ViewportState extends Camera {
  width: number;
  height: number;
  setCamera: (camera: Partial<Camera>) => void;
  panBy: (dx: number, dy: number) => void;
  setSize: (width: number, height: number) => void;
  /** Zoom about a screen-space point, keeping the world point under it fixed. */
  zoomAt: (screenX: number, screenY: number, factor: number) => void;
  setScale: (scale: number) => void;
  reset: () => void;
  fit: (rect: Rect, padding?: number) => void;
}

const clampScale = (scale: number): number =>
  Math.min(LIMITS.MAX_ZOOM, Math.max(LIMITS.MIN_ZOOM, scale));

export const useViewportStore = create<ViewportState>((set, get) => ({
  x: 0,
  y: 0,
  scale: 1,
  width: 1200,
  height: 800,

  setCamera: (camera) =>
    set((state) => ({
      ...camera,
      ...(camera.scale !== undefined ? { scale: clampScale(camera.scale) } : {}),
      ...(state.scale > LIMITS.MAX_ZOOM ? { scale: LIMITS.MAX_ZOOM } : {}),
    })),

  panBy: (dx, dy) => set((state) => ({ x: state.x + dx, y: state.y + dy })),

  setSize: (width, height) => set({ width, height }),

  zoomAt: (screenX, screenY, factor) =>
    set((state) => {
      const scale = clampScale(state.scale * factor);
      if (scale === state.scale) return state;
      const worldX = (screenX - state.x) / state.scale;
      const worldY = (screenY - state.y) / state.scale;
      return {
        scale,
        x: screenX - worldX * scale,
        y: screenY - worldY * scale,
      };
    }),

  setScale: (scale) => {
    const state = get();
    state.zoomAt(state.width / 2, state.height / 2, clampScale(scale) / state.scale);
  },

  reset: () => set({ x: 0, y: 0, scale: 1 }),

  fit: (rect, padding = 96) => {
    const { width, height } = get();
    const boxWidth = Math.max(rect.maxX - rect.minX, 1);
    const boxHeight = Math.max(rect.maxY - rect.minY, 1);
    const scale = clampScale(
      Math.min((width - padding * 2) / boxWidth, (height - padding * 2) / boxHeight),
    );
    set({
      scale,
      x: width / 2 - ((rect.minX + rect.maxX) / 2) * scale,
      y: height / 2 - ((rect.minY + rect.maxY) / 2) * scale,
    });
  },
}));

export function cameraOf(state: ViewportState): Camera {
  return { x: state.x, y: state.y, scale: state.scale };
}
