import type { Role, ToolId } from '@syncboard/shared';
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
  role: Role | null;
  cursor: CursorState | null;
  selection: string[];
  tool: ToolId | null;
  presenting: boolean;
  watching: boolean;
  viewport: Camera | null;
}

export interface AwarenessState {
  user: PresenceUser;
  role: Role;
  cursor: CursorState | null;
  selection: string[];
  tool: ToolId;
  presenting: boolean;
  watching: boolean;
  viewport: Camera | null;
}
