import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';
import {
  API_BASE_URL,
  API_PREFIX,
  attemptUiMutation,
  connectBoardObserver,
  craftElementInsertFrame,
  createBoard,
  drawRectangle,
  ensureSeedUsers,
  grantBoardRole,
  hashElements,
  injectRawFrame,
  openBoard,
  readPageElements,
  signIn,
  waitForPageElements,
  type BoardObserver,
  type SeedUser,
} from './helpers';

const INJECTED_ID = `viewer-forgery-${randomUUID().slice(0, 8)}`;

test.describe('viewer role enforcement', () => {
  let request: APIRequestContext;
  let owner: SeedUser;
  let viewer: SeedUser;
  let boardId: string;
  let viewerContext: BrowserContext;
  let observer: BoardObserver | undefined;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({ baseURL: API_BASE_URL });
    const users = await ensureSeedUsers(request, ['owner', 'viewer']);
    owner = users.owner;
    viewer = users.viewer;
  });

  test.beforeEach(async () => {
    const board = await createBoard(request, owner, `RBAC ${randomUUID().slice(0, 8)}`);
    boardId = board.id;
    await grantBoardRole(request, owner, boardId, viewer, 'VIEWER');
  });

  test.afterEach(async () => {
    observer?.close();
    observer = undefined;
    await viewerContext?.close();
  });

  test.afterAll(async () => {
    await request?.dispose();
  });

  test('viewer cannot mutate through the UI, REST, or forged Yjs WebSocket frames', async ({
    page,
    browser,
  }) => {
    viewerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const viewerPage = await viewerContext.newPage();

    await signIn(page, owner);
    await signIn(viewerPage, viewer);
    await openBoard(page, boardId);
    await openBoard(viewerPage, boardId);
    observer = await connectBoardObserver(request, owner, boardId);

    await drawRectangle(page, { x: 200, y: 170 }, { x: 340, y: 260 });
    await observer.waitFor((elements) => Object.keys(elements).length === 1, 5_000);
    await waitForPageElements(
      viewerPage,
      boardId,
      (elements) => Object.keys(elements).length === 1,
      5_000,
    );
    const baseline = observer.elements();
    const baselineHash = hashElements(baseline);

    // 1. Ordinary UI interaction in read-only mode.
    await attemptUiMutation(viewerPage);
    await viewerPage.waitForTimeout(350);

    // 2. REST mutation must be rejected by the server-side RBAC guard.
    const forbidden = await request.patch(`${API_BASE_URL}${API_PREFIX}/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${viewer.accessToken}` },
      data: { title: 'viewer takeover' },
    });
    expect(forbidden.status(), 'viewer was allowed to rename a board over REST').toBe(403);

    // 3. A crafted binary Yjs update sent from inside the viewer's browser.
    const frame = await craftElementInsertFrame(INJECTED_ID);
    await injectRawFrame(viewerPage, request, viewer, boardId, frame);

    await viewerPage.waitForTimeout(1_200);
    const after = observer.elements();

    expect(Object.keys(after), 'viewer forged a new element into the CRDT document').toEqual(
      Object.keys(baseline),
    );
    expect(after[INJECTED_ID], 'forged element id is present in shared state').toBeUndefined();
    expect(hashElements(after), 'viewer changed durable board state').toBe(baselineHash);

    const viewerView = await readPageElements(viewerPage, boardId);
    if (viewerView.elements) {
      expect(hashElements(viewerView.elements), 'viewer client accepted a forbidden update').toBe(
        baselineHash,
      );
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'Viewer client state was not directly readable; server Yjs observer confirmed the forged update was dropped.',
      });
    }
  });
});
