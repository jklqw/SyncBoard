import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { Role } from '@syncboard/shared';
import type { AwarenessState, PeerState } from './types';

const ROLES: Role[] = ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER'];

function asRole(value: unknown): Role | null {
  return typeof value === 'string' && (ROLES as string[]).includes(value) ? (value as Role) : null;
}

function asState(value: unknown): AwarenessState | null {
  if (typeof value !== 'object' || value === null) return null;
  const state = value as Partial<AwarenessState>;
  if (!state.user || typeof state.user !== 'object') return null;
  return {
    user: state.user,
    role: asRole(state.role) ?? 'VIEWER',
    cursor: state.cursor ?? null,
    selection: Array.isArray(state.selection) ? state.selection : [],
    tool: state.tool ?? 'select',
    presenting: state.presenting === true,
    watching: state.watching === true,
    viewport: state.viewport ?? null,
  };
}

export function usePresence(awareness: Awareness): PeerState[] {
  const [peers, setPeers] = useState<PeerState[]>([]);

  useEffect(() => {
    const read = (): void => {
      const next: PeerState[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const parsed = asState(state);
        if (!parsed) return;
        next.push({
          clientId,
          user: parsed.user,
          role: parsed.role,
          cursor: parsed.cursor,
          selection: parsed.selection,
          tool: parsed.tool,
          presenting: parsed.presenting,
          watching: parsed.watching,
          viewport: parsed.viewport,
        });
      });
      setPeers(next);
    };
    read();
    awareness.on('change', read);
    return () => awareness.off('change', read);
  }, [awareness]);

  return peers;
}
