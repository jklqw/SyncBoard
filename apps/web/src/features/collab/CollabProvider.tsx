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
import { canWriteDocument, roleAtLeast } from '@syncboard/shared';
import { useAuth } from '../../app/AuthProvider';
import { cameraOf, useViewportStore, type Camera } from '../../stores/useViewportStore';
import { useUiStore } from '../../stores/useUiStore';
import { PRESENCE_COLORS } from '@syncboard/shared';
import { useYDoc, type YDocApi } from './useYDoc';
import { YjsWebSocketProvider } from './YjsWebSocketProvider';
import { useIndexedDbPersistence } from './offline';
import { usePresence } from './usePresence';
import { useRemoteCursors } from './useRemoteCursors';
import type {
  AwarenessState,
  ConnectionStatus,
  CursorState,
  PeerState,
  PresenceUser,
} from './types';

interface CollabContextValue extends YDocApi {
  awareness: Awareness;
  status: ConnectionStatus;
  role: Role;
  watching: boolean;
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
  watching = false,
  children,
}: {
  boardId: string;
  role: Role;
  watching?: boolean;
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

  // Watch mode is a local, read-only lens: even an owner who opens a watch
  // link cannot edit or reveal a cursor until they leave watch mode.
  const canWrite = canWriteDocument(liveRole) && !watching;
  // Viewers can read and follow, but their pointers/selection are not broadcast.
  const canShowPresence = !watching && roleAtLeast(liveRole, 'COMMENTER');
  const peers = usePresence(awareness);
  const remoteCursors = useRemoteCursors(peers);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const setUiStatus = useUiStore((state) => state.setSyncStatus);
  const setPresentingUi = useUiStore((state) => state.setPresenting);
  const setFollowingName = useUiStore((state) => state.setFollowingName);

  const guestId = useRef<string | null>(null);
  if (!guestId.current) guestId.current = `guest-${crypto.randomUUID().slice(0, 8)}`;

  const presenceUser = useMemo<PresenceUser>(() => {
    const id = user?.id ?? guestId.current ?? 'guest';
    return {
      id,
      name: user?.displayName ?? 'Guest',
      color: user?.avatarColor ?? hashColor(id),
    };
  }, [user]);

  useIndexedDbPersistence(doc, boardId);

  const liveRoleRef = useRef(liveRole);
  useEffect(() => {
    liveRoleRef.current = liveRole;
  }, [liveRole]);

  useEffect(() => {
    awareness.setLocalState({
      user: presenceUser,
      role: liveRoleRef.current,
      cursor: null,
      selection: [],
      tool: 'select',
      presenting: false,
      watching,
      viewport: null,
    } satisfies AwarenessState);
    return () => awareness.setLocalState(null);
  }, [awareness, presenceUser, watching]);

  useEffect(() => {
    awareness.setLocalStateField('role', liveRole);
  }, [awareness, liveRole]);

  useEffect(() => {
    if (canShowPresence) return;
    awareness.setLocalStateField('cursor', null);
    awareness.setLocalStateField('selection', []);
  }, [awareness, canShowPresence]);

  useEffect(() => {
    if (canWrite) return;
    if (awareness.getLocalState()?.['presenting'] !== true) return;
    awareness.setLocalStateField('presenting', false);
    awareness.setLocalStateField('viewport', null);
    setPresentingUi(false);
  }, [awareness, canWrite, setPresentingUi]);

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
    // usePresence already excludes the local client, so any presenting peer is
    // somebody else's view — even when both tabs are logged into the same account.
    setFollowingName(presenter ? (presenter.user?.name ?? null) : null);
  }, [presenter, setFollowingName]);

  const lastCursorAt = useRef(0);
  const lastViewportAt = useRef(0);

  const setCursor = useCallback(
    (cursor: CursorState | null) => {
      // Watchers and viewers have no cursor as far as the room is concerned.
      if (!canShowPresence) return;
      const now = performance.now();
      if (cursor && now - lastCursorAt.current < 1000 / 30) return;
      lastCursorAt.current = now;
      awareness.setLocalStateField('cursor', cursor);
    },
    [awareness, canShowPresence],
  );

  const setSelection = useCallback(
    (ids: string[]) => {
      if (!canShowPresence) return;
      awareness.setLocalStateField('selection', ids);
    },
    [awareness, canShowPresence],
  );

  const setTool = useCallback(
    (tool: ToolId) => awareness.setLocalStateField('tool', tool),
    [awareness],
  );

  const setPresenting = useCallback(
    (active: boolean) => {
      if (!canWrite) return;
      const current = awareness.getLocalState();
      if (!current) return;
      // Publish the current camera in the same awareness frame as the mode flag.
      // Followers can then jump to the presenter's view instantly, without
      // waiting for the first pan/zoom after the toggle.
      awareness.setLocalState({
        ...current,
        presenting: active,
        viewport: active ? cameraOf(useViewportStore.getState()) : null,
      });
      setPresentingUi(active);
    },
    [awareness, canWrite, setPresentingUi],
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
      role: liveRole,
      watching,
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
      liveRole,
      watching,
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
