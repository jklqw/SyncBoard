import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import {
  messageAwareness,
  messageSync,
  messageYjsSyncStep1,
  messageYjsUpdate,
  readSyncMessage,
} from 'y-protocols/sync';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';
import { API_URL } from '../../app/api';
import { boardsApi } from '../../app/api';
import { REMOTE_ORIGIN, type ConnectionStatus } from './types';

/**
 * Wire format (matches the server codec in apps/server/.../yjs-protocol.ts):
 *   sync      -> varUint(MSG_SYNC=0), varUint(syncType), varUint8Array(payload)
 *   awareness -> varUint(MSG_AWARENESS=1), varUint8Array(update)
 * No outer length wrapper — lib0 varUint fields are self-delimiting.
 */
function syncFrame(syncType: number, payload: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  encoding.writeVarUint(encoder, syncType);
  encoding.writeVarUint8Array(encoder, payload);
  return encoding.toUint8Array(encoder);
}

function awarenessFrame(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageAwareness);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

function awarenessUpdate(awareness: Awareness, clientIds: number[]): Uint8Array {
  return encodeAwarenessUpdate(awareness, clientIds);
}

export interface ProviderOptions {
  boardId: string;
  doc: Y.Doc;
  awareness: Awareness;
  canWrite: boolean;
  onStatus: (status: ConnectionStatus) => void;
  /** JSON control frames from the server (errors, role changes, comments). */
  onJson?: (message: unknown) => void;
}

/**
 * Raw binary Yjs transport. Authentication uses a short-lived one-time WS ticket,
 * never a long-lived JWT in the URL. Awareness rides on the same socket.
 */
export class YjsWebSocketProvider {
  private socket: WebSocket | null = null;
  private readonly options: ProviderOptions;
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private disposed = false;
  private status: ConnectionStatus = 'connecting';

  constructor(options: ProviderOptions) {
    this.options = options;
    this.options.doc.on('update', this.handleDocUpdate);
    this.options.awareness.on('update', this.handleAwarenessUpdate);
    void this.connect();
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.options.onStatus(status);
  }

  private async connect(): Promise<void> {
    if (this.disposed) return;
    this.setStatus(this.reconnectAttempt === 0 ? 'connecting' : 'reconnecting');
    try {
      const { ticket } = await boardsApi.wsTicket(this.options.boardId);
      if (this.disposed) return;
      const base = API_URL.replace(/^http/, 'ws').replace(/\/$/, '');
      const url = `${base}/ws/boards/${encodeURIComponent(this.options.boardId)}?ticket=${encodeURIComponent(ticket)}`;
      const socket = new WebSocket(url);
      socket.binaryType = 'arraybuffer';
      this.socket = socket;

      socket.onopen = () => {
        this.reconnectAttempt = 0;
        this.setStatus('connected');
        socket.send(syncFrame(messageYjsSyncStep1, Y.encodeStateVector(this.options.doc)));
        socket.send(
          awarenessFrame(awarenessUpdate(this.options.awareness, [this.options.doc.clientID])),
        );
      };

      socket.onmessage = (event: MessageEvent<ArrayBuffer | Blob | string>) => {
        if (this.disposed) return;
        void this.readMessage(event.data);
      };

      socket.onclose = () => {
        if (this.socket === socket) this.socket = null;
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        // The close event performs the actual retry so we never double-schedule.
        socket.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private async readMessage(data: ArrayBuffer | Blob | string): Promise<void> {
    // JSON control frames (errors, role-changed, comment broadcasts) arrive as text.
    if (typeof data === 'string') {
      try {
        this.options.onJson?.(JSON.parse(data));
      } catch {
        // Ignore malformed control frames.
      }
      return;
    }

    let bytes: Uint8Array;
    if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else bytes = new Uint8Array(await data.arrayBuffer());

    try {
      // A single frame may carry several concatenated protocol messages
      // (the server packs syncStep2 + syncStep1 into one reply).
      const decoder = decoding.createDecoder(bytes);
      while (decoding.hasContent(decoder)) {
        const messageType = decoding.readVarUint(decoder);
        if (messageType === messageSync) {
          const encoder = encoding.createEncoder();
          readSyncMessage(decoder, encoder, this.options.doc, REMOTE_ORIGIN);
          if (encoding.length(encoder) > 1) {
            this.send(encoding.toUint8Array(encoder));
          }
        } else if (messageType === messageAwareness) {
          const update = decoding.readVarUint8Array(decoder);
          applyAwarenessUpdate(this.options.awareness, update, REMOTE_ORIGIN);
        } else {
          // Unknown opcode — stop parsing this frame rather than misaligning.
          break;
        }
      }
    } catch {
      // A malformed frame must never crash the editor; ignore it.
    }
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === REMOTE_ORIGIN) return;
    if (!this.options.canWrite) return;
    this.send(syncFrame(messageYjsUpdate, update));
  };

  private handleAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    if (origin === REMOTE_ORIGIN) return;
    const changed = [...changes.added, ...changes.updated, ...changes.removed];
    this.send(awarenessFrame(awarenessUpdate(this.options.awareness, changed)));
  };

  private send(data: Uint8Array): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(data);
    } catch {
      // A socket can close between the readiness check and send; reconnect handles it.
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer !== null) return;
    this.reconnectAttempt += 1;
    const backoff = Math.min(15_000, 500 * 2 ** Math.min(this.reconnectAttempt - 1, 5));
    const delay = backoff * (0.8 + Math.random() * 0.4);
    this.setStatus('offline');
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  destroy(): void {
    this.disposed = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.options.doc.off('update', this.handleDocUpdate);
    this.options.awareness.off('update', this.handleAwarenessUpdate);
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  }
}
