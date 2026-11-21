import { describe, expect, it } from 'vitest';
import {
  ElementSchema,
  LIMITS,
  canComment,
  canWriteDocument,
  parseElement,
  roleAtLeast,
} from '../src/index';

const base = {
  id: 'el-1',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  zIndex: 'aV',
  style: { fill: '#fff', stroke: '#18181B', strokeWidth: 1, opacity: 1, roughness: 0 },
  locked: false,
  updatedAt: 1,
};

describe('shared schemas and roles', () => {
  it('parses a valid rectangle and rejects invalid payloads', () => {
    const parsed = ElementSchema.parse({ ...base, type: 'rectangle' });
    expect(parsed.type).toBe('rectangle');
    expect(() =>
      ElementSchema.parse({
        ...base,
        type: 'rectangle',
        style: { ...base.style, opacity: 2 },
      }),
    ).toThrow();
    expect(() => parseElement({ ...base, type: 'unknown' })).toThrow();
  });

  it('validates arrow bindings and point arrays', () => {
    const arrow = parseElement({
      ...base,
      type: 'arrow',
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      startBinding: { elementId: 'r1', anchor: 'right' },
      endBinding: null,
    });
    expect(arrow.type).toBe('arrow');
    if (arrow.type === 'arrow') expect(arrow.startBinding?.anchor).toBe('right');
    expect(() => parseElement({ ...base, type: 'arrow', points: [{ x: 0, y: 0 }] })).toThrow();
  });

  it('enforces the role hierarchy', () => {
    expect(roleAtLeast('OWNER', 'EDITOR')).toBe(true);
    expect(roleAtLeast('VIEWER', 'COMMENTER')).toBe(false);
    expect(canWriteDocument('EDITOR')).toBe(true);
    expect(canWriteDocument('COMMENTER')).toBe(false);
    expect(canComment('COMMENTER')).toBe(true);
    expect(canComment('VIEWER')).toBe(false);
  });

  it('exposes protocol limits', () => {
    expect(LIMITS.MAX_WS_FRAME_BYTES).toBe(1024 * 1024);
    expect(LIMITS.CURSOR_HZ).toBe(30);
  });
});
