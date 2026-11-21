import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Awareness } from 'y-protocols/awareness';
import type { Role, ToolId } from '@syncboard/shared';
import { canWriteDocument } from '@syncboard/shared';
import { useAuth } from '../../app/AuthProvider';
import type { Camera } from '../../stores/useViewportStore';
import { useUiStore } from '../../stores/useUiStore';
import { PRESENCE_COLORS } from '@syncboard/shared';
import { useYDoc, type YDocApi } from './useYDoc';
import { YjsWebSocketProvider } from './YjsWebSocketProvider';
import { useIndexedDbPersistence } from './offline';
import { usePresence } from './usePresence';
import { useRemoteCursors } from './useRemoteCursors';
import type { AwarenessState, ConnectionStatus, CursorState, PeerState, PresenceUser } from './types';

interface CollabContextValue extends YDocApi {
  awareness: Awareness;
  status: ConnectionStatus;
  canWrite: boolean;
  user: PresenceUser;
  peers: PeerState[];
  presenter: PeerState | null;
  remoteCursors: Map<number, CursorState>;
  setCursor: (cursor: CursorState | null) => void;
  setSelection: (ids: string[]) => void;
  setTool: (tool: ToolId) => void;
  setPresenting: (active: boolean) => void;
  broadcastViewport: (camera: Camera) => void;
}

const CollabContext = createContext<CollabContextValue | null>(null);

function hashColor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length] ?? '#6B8CAE';
}

export function CollabProvider({
  boardId,
  role,
  children,
}: {
  boardId: string;
  role: Role;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const ydoc = useYDoc();
  const [liveRole, setLiveRole] = useState<Role>(role);
  useEffect(() => setLiveRole(role), [role]);
  const { doc, awareness } = useMemo(() => {
    const next = new Awareness(ydoc.doc);
    return { doc: ydoc.doc, awareness: next };
  }, [ydoc.doc]);

  const canWrite = canWriteDocument(liveRole);
  const peers = usePresence(awareness);
  const remoteCursors = useRemoteCursors(peers);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const setUiStatus = useUiStore((state) => state.setSyncStatus);
  const setPresentingUi = useUiStore((state) => state.setPresenting);
  const setFollowingName = useUiStore((state) => state.setFollowingName);

  const presenceUser = useMemo<PresenceUser>(
    () => ({
      id: user?.id ?? 'anonymous',
      name: user?.displayName ?? 'Guest',
      color: user?.avatarColor ?? hashColor(user?.id ?? 'anonymous'),
    }),
    [user],
  );

  useIndexedDbPersistence(doc, boardId);

  useEffect(() => {
    awareness.setLocalState({
      user: presenceUser,
      cursor: null,
      selection: [],
      tool: 'select',
      presenting: false,
      viewport: null,
    } satisfies AwarenessState);
    return () => awareness.setLocalState(null);
  }, [awareness, presenceUser]);

  useEffect(() => {
    const provider = new YjsWebSocketProvider({
      boardId,
      doc,
      awareness,
      canWrite,
      onStatus: setStatus,
      onJson: (message) => {
        if (typeof message !== 'object' || message === null) return;
        const frame = message as { type?: string; role?: Role };
        if (frame.type === 'role-changed' && frame.role) {
          setLiveRole(frame.role);
        } else if (frame.type && frame.type.startsWith('comment:')) {
          window.dispatchEvent(new CustomEvent('syncboard:comment', { detail: frame }));
        }
      },
    });
    return () => provider.destroy();
  }, [boardId, doc, awareness, canWrite]);

  useEffect(() => {
    setUiStatus(status === 'connected' ? 'online' : status);
  }, [status, setUiStatus]);

  const presenter = useMemo(() => peers.find((peer) => peer.presenting) ?? null, [peers]);

  useEffect(() => {
    setFollowingName(presenter && presenter.user?.id !== presenceUser.id ? (presenter.user?.name ?? null) : null);
  }, [presenter, presenceUser.id, setFollowingName]);

  const lastCursorAt = useRef(0);
  const lastViewportAt = useRef(0);

  const setCursor = useCallback(
    (cursor: CursorState | null) => {
      const now = performance.now();
      if (cursor && now - lastCursorAt.current < 1000 / 30) return;
      lastCursorAt.current = now;
      awareness.setLocalStateField('cursor', cursor);
    },
    [awareness],
  );

  const setSelection = useCallback(
    (ids: string[]) => awareness.setLocalStateField('selection', ids),
    [awareness],
  );

  const setTool = useCallback(
    (tool: ToolId) => awareness.setLocalStateField('tool', tool),
    [awareness],
  );

  const setPresenting = useCallback(
    (active: boolean) => {
      awareness.setLocalStateField('presenting', active);
      setPresentingUi(active);
    },
    [awareness, setPresentingUi],
  );

  const broadcastViewport = useCallback(
    (camera: Camera) => {
      if (!awareness.getLocalState()?.['presenting']) return;
      const now = performance.now();
      if (now - lastViewportAt.current < 90) return;
      lastViewportAt.current = now;
      awareness.setLocalStateField('viewport', camera);
    },
    [awareness],
  );

  const value = useMemo<CollabContextValue>(
    () => ({
      ...ydoc,
      awareness,
      status,
      canWrite,
      user: presenceUser,
      peers,
      presenter,
      remoteCursors,
      setCursor,
      setSelection,
      setTool,
      setPresenting,
      broadcastViewport,
    }),
    [
      ydoc,
      awareness,
      status,
      canWrite,
      presenceUser,
      peers,
      presenter,
      remoteCursors,
      setCursor,
      setSelection,
      setTool,
      setPresenting,
      broadcastViewport,
    ],
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}

export function useCollab(): CollabContextValue {
  const context = useContext(CollabContext);
  if (!context) throw new Error('useCollab must be used inside <CollabProvider>');
  return context;
}
