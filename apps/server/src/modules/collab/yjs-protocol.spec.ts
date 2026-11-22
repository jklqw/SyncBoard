import * as encoding from 'lib0/encoding';
import { readAwarenessEntries, sanitizeAwarenessUpdate } from './yjs-protocol';

function encodeAwareness(entries: Array<[number, number, unknown]>): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, entries.length);
  for (const [clientId, clock, state] of entries) {
    encoding.writeVarUint(encoder, clientId);
    encoding.writeVarUint(encoder, clock);
    encoding.writeVarString(encoder, JSON.stringify(state));
  }
  return encoding.toUint8Array(encoder);
}

describe('sanitizeAwarenessUpdate', () => {
  it('can strip a viewer cursor while preserving clocks and other clients', () => {
    const update = encodeAwareness([
      [7, 3, { role: 'EDITOR', cursor: { x: 1, y: 2 } }],
      [9, 8, { role: 'VIEWER', cursor: { x: 9, y: 9 }, selection: ['el-1'] }],
    ]);

    const clean = sanitizeAwarenessUpdate(update, (clientId, state) => {
      if (clientId !== 9 || state === null || typeof state !== 'object') return state;
      const next = { ...(state as Record<string, unknown>) };
      delete next['cursor'];
      next['selection'] = [];
      return next;
    });

    const entries = readAwarenessEntries(clean);
    expect(entries.map((entry) => [entry.clientId, entry.clock])).toEqual([
      [7, 3],
      [9, 8],
    ]);
    expect(entries[0]?.state).toEqual({ role: 'EDITOR', cursor: { x: 1, y: 2 } });
    expect(entries[1]?.state).toEqual({ role: 'VIEWER', selection: [] });
  });
});
