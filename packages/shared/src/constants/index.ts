/** Canonical limits and protocol identifiers shared by the web and server apps. */
export const LIMITS = {
  MAX_ELEMENTS_PER_BOARD: 20_000,
  MAX_ELEMENT_SIZE_BYTES: 64 * 1024,
  MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
  MAX_UPLOAD_DIMENSION: 8192,
  MAX_WS_FRAME_BYTES: 1024 * 1024,
  MAX_WS_FRAMES_PER_SECOND: 120,
  CURSOR_HZ: 30,
  SNAPSHOT_DEBOUNCE_MS: 3000,
  SNAPSHOT_CEILING_MS: 15_000,
  SNAPSHOT_INTERVAL_MS: 600_000,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5,
  GRID_SIZE: 24,
} as const;

export const API_PREFIX = '/api/v1';

/** Binary Yjs message opcodes as defined by y-protocols. */
export const WS_MESSAGE = {
  SYNC: 0,
  AWARENESS: 1,
  AUTH: 2,
  REVOKE: 3,
} as const;

/** Muted pastel presence palette; never neon. */
export const PRESENCE_COLORS = [
  '#C2705D',
  '#5B8E7D',
  '#7C7B8A',
  '#B08968',
  '#6B8CAE',
  '#A37A94',
  '#8A9A5B',
  '#B56576',
] as const;

export const TOOL_IDS = [
  'select',
  'hand',
  'rectangle',
  'ellipse',
  'line',
  'arrow',
  'pen',
  'eraser',
  'text',
  'sticky',
  'image',
  'code',
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

/** Fractional indexing keeps CRDT reordering conflict-free (no numeric renumbering). */
export const ZINDEX_STEP = 'a';
