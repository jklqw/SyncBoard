import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import RBush from 'rbush';
import { getElementBounds, parseElement, type CanvasElement, type Rect } from '@syncboard/shared';
import { LOCAL_ORIGIN } from './types';

export interface SpatialEntry extends Rect {
  id: string;
}

type ElementRecord = Record<string, unknown>;

/**
 * Canonical on-wire shape: `elements` is a Y.Map keyed by element id whose
 * values are Y.Maps of flat fields. Object-valued fields (style, points,
 * bindings) are stored as JSON strings so every client and the server's
 * template/restore paths agree on one representation.
 */
const JSON_FIELDS = new Set(['style', 'points', 'startBinding', 'endBinding']);

function encodeField(key: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (JSON_FIELDS.has(key)) return JSON.stringify(value);
  return value;
}

function decodeField(key: string, value: unknown): unknown {
  if (typeof value !== 'string' || !JSON_FIELDS.has(key)) return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/** Plain encoded fields. Reading a Y.Map before it is integrated returns no entries. */
function toFields(element: CanvasElement): ElementRecord {
  const fields: ElementRecord = {};
  const raw = element as unknown as ElementRecord;
  for (const [key, value] of Object.entries(raw)) {
    const encoded = encodeField(key, value);
    if (encoded !== undefined) fields[key] = encoded;
  }
  return fields;
}

function toYMap(fields: ElementRecord): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(fields)) map.set(key, value);
  return map;
}

function fromYMap(map: Y.Map<unknown>): CanvasElement | null {
  try {
    const raw: ElementRecord = {};
    map.forEach((value, key) => {
      raw[key] = decodeField(key, value);
    });
    return parseElement(raw);
  } catch {
    return null;
  }
}

function recordKey(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null);
}

export interface YDocApi {
  doc: Y.Doc;
  elements: CanvasElement[];
  elementMap: Y.Map<Y.Map<unknown>>;
  spatialIndex: RBush<SpatialEntry>;
  upsertElements: (elements: CanvasElement[]) => void;
  removeElements: (ids: string[]) => void;
  replaceAll: (elements: CanvasElement[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useYDoc(): YDocApi {
  const doc = useMemo(() => new Y.Doc({ gc: true }), []);
  const elementMap = useMemo(() => doc.getMap<Y.Map<unknown>>('elements'), [doc]);
  const spatialIndex = useMemo(() => new RBush<SpatialEntry>(), []);
  const undoManager = useMemo(
    () =>
      new Y.UndoManager(elementMap, {
        trackedOrigins: new Set<unknown>([LOCAL_ORIGIN]),
        captureTimeout: 300,
      }),
    [elementMap],
  );

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });

  const rebuild = useCallback(() => {
    const next: CanvasElement[] = [];
    const invalidIds: string[] = [];
    elementMap.forEach((map, id) => {
      const element = fromYMap(map);
      if (element) next.push(element);
      else invalidIds.push(id);
    });
    // Older clients could leave empty element maps behind. Drop them once so
    // they no longer poison the spatial index or zoom-to-fit bounds.
    if (invalidIds.length > 0) {
      queueMicrotask(() => {
        doc.transact(() => {
          for (const id of invalidIds) if (elementMap.has(id)) elementMap.delete(id);
        }, LOCAL_ORIGIN);
      });
    }
    next.sort((a, b) => a.zIndex.localeCompare(b.zIndex));
    spatialIndex.clear();
    spatialIndex.load(
      next.map((element) => {
        const bounds = getElementBounds(element);
        return { id: element.id, ...bounds };
      }),
    );
    setElements(next);
  }, [doc, elementMap, spatialIndex]);

  useEffect(() => {
    rebuild();
    elementMap.observeDeep(rebuild);
    return () => elementMap.unobserveDeep(rebuild);
  }, [elementMap, rebuild]);

  useEffect(() => {
    const update = (): void => {
      setHistory({
        canUndo: undoManager.undoStack.length > 0,
        canRedo: undoManager.redoStack.length > 0,
      });
    };
    undoManager.on('stack-item-added', update);
    undoManager.on('stack-item-popped', update);
    undoManager.on('stack-item-updated', update);
    undoManager.on('stack-cleared', update);
    return () => {
      undoManager.off('stack-item-added', update);
      undoManager.off('stack-item-popped', update);
      undoManager.off('stack-item-updated', update);
      undoManager.off('stack-cleared', update);
    };
  }, [undoManager]);

  const upsertElements = useCallback(
    (incoming: CanvasElement[]) => {
      if (incoming.length === 0) return;
      doc.transact(() => {
        for (const element of incoming) {
          const next = toFields(element);
          const existing = elementMap.get(element.id);
          if (!existing) {
            elementMap.set(element.id, toYMap(next));
            continue;
          }
          for (const [key, value] of Object.entries(next)) {
            if (recordKey(existing.get(key)) !== recordKey(value)) existing.set(key, value);
          }
          for (const key of [...existing.keys()]) {
            if (!(key in next)) existing.delete(key);
          }
        }
      }, LOCAL_ORIGIN);
    },
    [doc, elementMap],
  );

  const removeElements = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      doc.transact(() => {
        for (const id of ids) elementMap.delete(id);
      }, LOCAL_ORIGIN);
    },
    [doc, elementMap],
  );

  const replaceAll = useCallback(
    (incoming: CanvasElement[]) => {
      doc.transact(() => {
        for (const id of [...elementMap.keys()]) elementMap.delete(id);
        for (const element of incoming) elementMap.set(element.id, toYMap(toFields(element)));
      }, LOCAL_ORIGIN);
    },
    [doc, elementMap],
  );

  const undo = useCallback(() => undoManager.undo(), [undoManager]);
  const redo = useCallback(() => undoManager.redo(), [undoManager]);

  return useMemo(
    () => ({
      doc,
      elements,
      elementMap,
      spatialIndex,
      upsertElements,
      removeElements,
      replaceAll,
      undo,
      redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    }),
    [
      doc,
      elements,
      elementMap,
      spatialIndex,
      upsertElements,
      removeElements,
      replaceAll,
      undo,
      redo,
      history,
    ],
  );
}
