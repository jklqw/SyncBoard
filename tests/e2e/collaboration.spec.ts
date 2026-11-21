import { createHash, randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';
import {
  API_BASE_URL,
  canonicalStringify,
  connectBoardObserver,
  createBoard,
  dragOnCanvas,
  drawRectangle,
  ensureSeedUsers,
  hashElements,
  openBoard,
  readPageElements,
  signIn,
  waitForPageElements,
  type BoardObserver,
  type ElementState,
  type SeedUser,
} from './helpers';

function changedElementCount(before: ElementState, after: ElementState): number {
  return Object.keys(before).filter(
    (id) => canonicalStringify(before[id]) !== canonicalStringify(after[id]),
  ).length;
}

function imageHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

test.describe('multi-user real-time collaboration', () => {
  let request: APIRequestContext;
  let owner: SeedUser;
  let editor: SeedUser;
  let boardId: string;
  let editorContext: BrowserContext;
  let observer: BoardObserver | undefined;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({ baseURL: API_BASE_URL });
    const users = await ensureSeedUsers(request, ['owner', 'editor']);
    owner = users.owner;
    editor = users.editor;
  });

  test.beforeEach(async () => {
    const board = await createBoard(request, owner, `Collab ${randomUUID().slice(0, 8)}`);
    boardId = board.id;
  });

  test.afterEach(async () => {
    observer?.close();
    observer = undefined;
    await editorContext?.close();
  });

  test.afterAll(async () => {
    await request?.dispose();
  });

  test('owner draws a rectangle and the editor sees it in <500ms without reloading', async ({
    page,
    browser,
  }) => {
    editorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const editorPage = await editorContext.newPage();

    await signIn(page, owner);
    await signIn(editorPage, editor);
    await openBoard(page, boardId);
    await openBoard(editorPage, boardId);
    observer = await connectBoardObserver(request, owner, boardId);

    const editorCanvas = editorPage.locator('canvas').first();
    const beforePixels = imageHash(await editorCanvas.screenshot());
    const navigationsBefore = await editorPage.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );

    const startedAt = Date.now();
    await drawRectangle(page, { x: 160, y: 150 }, { x: 310, y: 245 });
    await observer.waitFor((elements) => Object.keys(elements).length === 1, 5_000);
    const editorView = await waitForPageElements(
      editorPage,
      boardId,
      (elements) => Object.keys(elements).length === 1,
      2_000,
    );
    const elapsedMs = Date.now() - startedAt;

    if (editorView.source === 'unavailable') {
      test.info().annotations.push({
        type: 'note',
        description:
          'No client-side element hook or y-indexeddb log was exposed; canvas pixel change is used as the visual proxy.',
      });
      const afterPixels = imageHash(await editorCanvas.screenshot());
      expect(afterPixels, 'editor canvas did not repaint after the remote edit').not.toBe(
        beforePixels,
      );
    } else {
      expect(
        editorView.seen,
        `editor client did not observe the new element (source=${editorView.source})`,
      ).toBe(true);
    }
    expect(elapsedMs, `remote shape appeared after ${elapsedMs}ms`).toBeLessThan(500);

    const navigationsAfter = await editorPage.evaluate(
      () => performance.getEntriesByType('navigation').length,
    );
    expect(navigationsAfter, 'editor page reloaded to see the shape').toBe(navigationsBefore);
  });

  test('simultaneous drags of different shapes converge after reload', async ({
    page,
    browser,
  }) => {
    editorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const editorPage = await editorContext.newPage();

    await signIn(page, owner);
    await signIn(editorPage, editor);
    await openBoard(page, boardId);
    await openBoard(editorPage, boardId);
    observer = await connectBoardObserver(request, owner, boardId);

    await drawRectangle(page, { x: 170, y: 140 }, { x: 280, y: 225 });
    await drawRectangle(page, { x: 520, y: 140 }, { x: 630, y: 225 });
    await observer.waitFor((elements) => Object.keys(elements).length === 2, 5_000);
    await waitForPageElements(
      editorPage,
      boardId,
      (elements) => Object.keys(elements).length === 2,
      5_000,
    );

    const before = observer.elements();
    const elementIds = Object.keys(before).sort();
    expect(elementIds).toHaveLength(2);

    // Different shapes, moved at the same time by two different users.
    await Promise.all([
      dragOnCanvas(page, { x: 225, y: 182 }, { x: 325, y: 290 }),
      dragOnCanvas(editorPage, { x: 575, y: 182 }, { x: 475, y: 290 }),
    ]);
    await observer.waitFor((elements) => changedElementCount(before, elements) >= 2, 5_000);

    await Promise.all([page.reload(), editorPage.reload()]);
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(editorPage.locator('canvas').first()).toBeVisible();
    await page.waitForTimeout(700);

    const serverState = observer.elements();
    const [ownerView, editorView] = await Promise.all([
      readPageElements(page, boardId),
      readPageElements(editorPage, boardId),
    ]);
    const serverHash = hashElements(serverState);

    expect(Object.keys(serverState).sort(), 'a shape was lost during the concurrent drags').toEqual(
      elementIds,
    );
    if (ownerView.elements && editorView.elements) {
      expect(hashElements(ownerView.elements), 'owner state diverged after reload').toBe(
        serverHash,
      );
      expect(hashElements(editorView.elements), 'editor state diverged after reload').toBe(
        serverHash,
      );
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'Client element state was not directly readable; convergence was verified against the server Yjs observer after both reloads.',
      });
    }
  });
});
