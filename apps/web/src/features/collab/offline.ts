import { useEffect } from 'react';
import type * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

const PREFIX = 'syncboard-board-';

/** Offline-first cache: local edits survive reloads and merge with the server on reconnect. */
export function useIndexedDbPersistence(doc: Y.Doc, boardId: string): void {
  useEffect(() => {
    let instance: IndexeddbPersistence | null = null;
    try {
      instance = new IndexeddbPersistence(`${PREFIX}${boardId}`, doc);
    } catch {
      // IndexedDB can be unavailable (private browsing); collaboration still works online.
    }
    return () => {
      void instance?.destroy();
    };
  }, [doc, boardId]);
}
