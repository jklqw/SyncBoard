import type { ToolId } from '@syncboard/shared';
import type { Camera } from '../../stores/useViewportStore';

export const LOCAL_ORIGIN = 'syncboard-local';
export const REMOTE_ORIGIN = 'syncboard-remote';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}

export interface CursorState {
  x: number;
  y: number;
}

export interface PeerState {
  clientId: number;
  user: PresenceUser | null;
  cursor: CursorState | null;
  selection: string[];
  tool: ToolId | null;
  presenting: boolean;
  viewport: Camera | null;
}

export interface AwarenessState {
  user: PresenceUser;
  cursor: CursorState | null;
  selection: string[];
  tool: ToolId;
  presenting: boolean;
  viewport: Camera | null;
}
