import { useEffect, useRef, useState } from 'react';
import type { CursorState, PeerState } from './types';

interface Tracked {
  current: CursorState;
  target: CursorState;
}

const EMPTY = new Map<number, CursorState>();

/** Linear interpolation on requestAnimationFrame turns 30 Hz packets into smooth pointers. */
export function useRemoteCursors(peers: PeerState[]): Map<number, CursorState> {
  const tracked = useRef(new Map<number, Tracked>());
  const [rendered, setRendered] = useState<Map<number, CursorState>>(EMPTY);

  useEffect(() => {
    const active = new Set<number>();
    for (const peer of peers) {
      // Watchers and viewers must stay invisible to editors, including pointers.
      if (peer.watching || peer.role === 'VIEWER' || !peer.cursor) continue;
      active.add(peer.clientId);
      const existing = tracked.current.get(peer.clientId);
      if (existing) existing.target = peer.cursor;
      else
        tracked.current.set(peer.clientId, {
          current: { ...peer.cursor },
          target: { ...peer.cursor },
        });
    }
    for (const clientId of [...tracked.current.keys()]) {
      if (!active.has(clientId)) tracked.current.delete(clientId);
    }
  }, [peers]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min(64, now - previous);
      previous = now;
      const smoothing = 1 - Math.exp(-dt / 70);
      let changed = false;
      const next = new Map<number, CursorState>();
      tracked.current.forEach((state, clientId) => {
        const dx = state.target.x - state.current.x;
        const dy = state.target.y - state.current.y;
        if (Math.abs(dx) > 0.15 || Math.abs(dy) > 0.15) {
          state.current = {
            x: state.current.x + dx * smoothing,
            y: state.current.y + dy * smoothing,
          };
          changed = true;
        }
        next.set(clientId, state.current);
      });
      if (changed || next.size !== rendered.size) setRendered(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rendered.size]);

  return rendered;
}
