import { create } from 'zustand';
import type { CanvasElement, ElementStyle, ToolId } from '@syncboard/shared';

export const DEFAULT_STYLE: ElementStyle = {
  fill: 'transparent',
  stroke: '#18181B',
  strokeWidth: 2,
  opacity: 1,
  roughness: 0,
  dashed: false,
  fontSize: 18,
};

interface ToolState {
  tool: ToolId;
  style: ElementStyle;
  selection: string[];
  editingId: string | null;
  clipboard: CanvasElement[];
  lockedAspect: boolean;
  snapToGrid: boolean;
  setTool: (tool: ToolId) => void;
  setStyle: (patch: Partial<ElementStyle>) => void;
  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  setEditingId: (id: string | null) => void;
  setClipboard: (elements: CanvasElement[]) => void;
  toggleAspect: () => void;
  toggleSnap: () => void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'select',
  style: DEFAULT_STYLE,
  selection: [],
  editingId: null,
  clipboard: [],
  lockedAspect: false,
  snapToGrid: false,

  setTool: (tool) => set({ tool, editingId: null }),
  setStyle: (patch) => set((state) => ({ style: { ...state.style, ...patch } })),
  setSelection: (ids) => set({ selection: ids }),
  toggleSelection: (id) =>
    set((state) => ({
      selection: state.selection.includes(id)
        ? state.selection.filter((value) => value !== id)
        : [...state.selection, id],
    })),
  clearSelection: () => set({ selection: [], editingId: null }),
  setEditingId: (editingId) => set({ editingId }),
  setClipboard: (clipboard) => set({ clipboard }),
  toggleAspect: () => set((state) => ({ lockedAspect: !state.lockedAspect })),
  toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
}));
