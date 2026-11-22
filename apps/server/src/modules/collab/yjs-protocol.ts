import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as Y from 'yjs';
import * as sync from 'y-protocols/sync';

/** Outer Yjs websocket message opcodes (shared with the client provider). */
export const MSG_SYNC = 0;
export const MSG_AWARENESS = 1;
export const MSG_AUTH = 2;

/** Sync sub-types, re-exported from y-protocols/sync. */
export const SYNC_STEP1 = sync.messageYjsSyncStep1;
export const SYNC_STEP2 = sync.messageYjsSyncStep2;
export const SYNC_UPDATE = sync.messageYjsUpdate;

/** `[MSG_SYNC, syncStep1, stateVector]` — safe for read-only roles. */
export function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  sync.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

/** `[MSG_SYNC, syncStep2, update]` — a document write message. */
export function encodeSyncStep2(doc: Y.Doc, stateVector?: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  sync.writeSyncStep2(encoder, doc, stateVector);
  return encoding.toUint8Array(encoder);
}

/** Server reply to a client Step1: Step2 (missing state) then Step1 (our vector). */
export function encodeSyncReplyToStep1(doc: Y.Doc, stateVector: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  sync.writeSyncStep2(encoder, doc, stateVector);
  encoding.writeVarUint(encoder, MSG_SYNC);
  sync.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

/** `[MSG_AWARENESS, awarenessUpdate]` */
export function encodeAwarenessMessage(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_AWARENESS);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

export interface AwarenessEntry {
  clientId: number;
  clock: number;
  state: unknown;
}

/** Decode a raw y-protocols awareness update without mutating an Awareness instance. */
export function readAwarenessEntries(update: Uint8Array): AwarenessEntry[] {
  const decoder = decoding.createDecoder(update);
  const count = decoding.readVarUint(decoder);
  const entries: AwarenessEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    entries.push({
      clientId: decoding.readVarUint(decoder),
      clock: decoding.readVarUint(decoder),
      state: JSON.parse(decoding.readVarString(decoder)) as unknown,
    });
  }
  return entries;
}

function writeAwarenessEntries(entries: AwarenessEntry[]): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, entries.length);
  for (const entry of entries) {
    encoding.writeVarUint(encoder, entry.clientId);
    encoding.writeVarUint(encoder, entry.clock);
    encoding.writeVarString(encoder, JSON.stringify(entry.state ?? null));
  }
  return encoding.toUint8Array(encoder);
}

/**
 * Rewrite awareness states before they enter the room. The callback sees the
 * originating client id so the server can enforce role-based presence fields.
 */
export function sanitizeAwarenessUpdate(
  update: Uint8Array,
  modify: (clientId: number, state: unknown) => unknown,
): Uint8Array {
  return writeAwarenessEntries(
    readAwarenessEntries(update).map((entry) => ({
      ...entry,
      state: modify(entry.clientId, entry.state),
    })),
  );
}
