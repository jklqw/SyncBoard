import * as decoding from 'lib0/decoding';
import { Role, canWriteBoard } from '../../common/constants/roles';
import { MSG_AWARENESS, MSG_SYNC, SYNC_STEP1, SYNC_STEP2, SYNC_UPDATE } from './yjs-protocol';

export type YjsMessageKind =
  | 'sync-step1'
  | 'sync-step2'
  | 'sync-update'
  | 'awareness'
  | 'unknown';

export interface ClassifiedYjsMessage {
  opcode: number;
  kind: YjsMessageKind;
  /** True for syncStep2 / update frames that mutate the Y.Doc. */
  isWrite: boolean;
  update: Uint8Array | null;
}

export interface YjsMessageDecision {
  allow: boolean;
  reason?: string;
}

/**
 * Pure, unit-testable classifier. It never applies the update — it only reads
 * the varUint envelope so guards can reject writes before mutation.
 */
export function classifyYjsMessage(data: Uint8Array): ClassifiedYjsMessage | null {
  try {
    const decoder = decoding.createDecoder(data);
    const opcode = decoding.readVarUint(decoder);

    if (opcode === MSG_SYNC) {
      const syncType = decoding.readVarUint(decoder);
      const update = decoding.readVarUint8Array(decoder);
      if (syncType === SYNC_STEP1) {
        return { opcode, kind: 'sync-step1', isWrite: false, update };
      }
      if (syncType === SYNC_STEP2) {
        return { opcode, kind: 'sync-step2', isWrite: true, update };
      }
      if (syncType === SYNC_UPDATE) {
        return { opcode, kind: 'sync-update', isWrite: true, update };
      }
      return { opcode, kind: 'unknown', isWrite: true, update };
    }

    if (opcode === MSG_AWARENESS) {
      const update = decoding.readVarUint8Array(decoder);
      return { opcode, kind: 'awareness', isWrite: false, update };
    }

    return { opcode, kind: 'unknown', isWrite: true, update: null };
  } catch {
    return null;
  }
}

/** Enforce the read-only boundary for VIEWER / COMMENTER roles. */
export function decideYjsMessageAllowance(
  role: Role | null | undefined,
  message: ClassifiedYjsMessage,
): YjsMessageDecision {
  if (message.kind === 'unknown') {
    return { allow: false, reason: 'unsupported-message' };
  }
  if (message.isWrite && !canWriteBoard(role)) {
    return { allow: false, reason: 'read-only-role' };
  }
  return { allow: true };
}
