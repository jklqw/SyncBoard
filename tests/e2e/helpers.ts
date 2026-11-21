/// <reference lib="dom" />
/**
 * Shared Playwright helpers for SyncBoard's multi-user collaboration specs.
 *
 * The helpers deliberately avoid coupling to a particular canvas component tree:
 * shapes are created with real pointer input on the Konva canvas, and document
 * state is read from (in order) an optional app debug hook, a test-id JSON mirror,
 * or the raw `y-indexeddb` update log that the client persists on every Yjs change.
 * A server-side Yjs observer is used as an independent convergence oracle.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';

export const API_BASE_URL =
  process.env.E2E_API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:3000';
export const API_PREFIX = '/api/v1';
const WS_ORIGIN = API_BASE_URL.replace(/^http/, 'ws');

const TEST_PASSWORD = 'E2eTest!2026'; // fixed, non-secret test credential
const SEED_TTL_MS = 10 * 60_000; // access JWTs live ~15 min; refresh early
const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(HERE, '.auth', 'seed-users.json');

export type SeedRole = 'owner' | 'editor' | 'viewer';

export interface SeedUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  password: string;
  accessToken: string;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export type ElementState = Record<string, unknown>;

interface SeedCache {
  savedAt: number;
  users: Partial<Record<SeedRole, SeedUser>>;
}

/* ------------------------------------------------------------------ *
 * REST helpers
 * ------------------------------------------------------------------ */

interface ApiOptions {
  token?: string;
  data?: unknown;
}

async function apiCall<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const init: { method: string; headers: Record<string, string>; data?: unknown } = {
    method,
    headers,
  };
  if (options.data !== undefined) init.data = options.data;

  const response = await request.fetch(`${API_BASE_URL}${API_PREFIX}${path}`, init);
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  if (!response.ok()) {
    throw new Error(`${method} ${path} -> HTTP ${response.status()}: ${text.slice(0, 600)}`);
  }
  return body as T;
}

function unwrap<T>(body: unknown, key: string): T | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const root = body as Record<string, unknown>;
  const direct = root[key];
  if (typeof direct === 'string' || typeof direct === 'object') return direct as T;
  const nested = root['data'];
  if (nested && typeof nested === 'object') {
    return (nested as Record<string, unknown>)[key] as T | undefined;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readSeedCache(): SeedCache {
  try {
    const parsed = JSON.parse(readFileSync(SEED_FILE, 'utf8')) as SeedCache;
    if (parsed && typeof parsed.savedAt === 'number' && parsed.users) return parsed;
  } catch {
    // first run, or a stale/corrupt cache: seed again
  }
  return { savedAt: 0, users: {} };
}

function writeSeedCache(cache: SeedCache): void {
  mkdirSync(dirname(SEED_FILE), { recursive: true });
  writeFileSync(SEED_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

async function registerOrLogin(request: APIRequestContext, role: SeedRole): Promise<SeedUser> {
  const suffix = `${role}-${randomUUID().slice(0, 8)}`;
  const email = `${suffix}@example.test`;
  const username = suffix.replace(/[^a-zA-Z0-9_.-]/g, '-');
  const displayName = role.charAt(0).toUpperCase() + role.slice(1);

  let body: unknown;
  try {
    body = await apiCall(request, 'POST', '/auth/register', {
      data: { email, username, displayName, password: TEST_PASSWORD },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/409|already| exists/i.test(message)) throw error;
    body = await apiCall(request, 'POST', '/auth/login', {
      data: { identifier: email, password: TEST_PASSWORD },
    });
  }

  const accessToken = unwrap<string>(body, 'accessToken') ?? unwrap<string>(body, 'token');
  if (!accessToken) throw new Error(`Auth response for ${role} contained no access token`);
  const user = asRecord(unwrap<unknown>(body, 'user') ?? body);
  return {
    id: typeof user['id'] === 'string' ? user['id'] : '',
    email,
    username,
    displayName,
    password: TEST_PASSWORD,
    accessToken,
  };
}

/** Reuses a short-lived on-disk cache so a spec file never burns the register rate limit. */
export async function ensureSeedUsers(
  request: APIRequestContext,
  roles: readonly SeedRole[],
): Promise<Record<SeedRole, SeedUser>> {
  const cache = readSeedCache();
  const fresh = Date.now() - cache.savedAt < SEED_TTL_MS;
  for (const role of roles) {
    const existing = cache.users[role];
    if (fresh && existing?.accessToken) continue;
    if (existing?.email) {
      try {
        const body = await apiCall(request, 'POST', '/auth/login', {
          data: { identifier: existing.email, password: existing.password },
        });
        const token = unwrap<string>(body, 'accessToken') ?? unwrap<string>(body, 'token');
        if (token) cache.users[role] = { ...existing, accessToken: token };
      } catch {
        delete cache.users[role];
      }
    }
    if (!cache.users[role]) cache.users[role] = await registerOrLogin(request, role);
  }
  cache.savedAt = Date.now();
  writeSeedCache(cache);

  const result = {} as Record<SeedRole, SeedUser>;
  for (const role of roles) {
    const user = cache.users[role];
    if (!user) throw new Error(`Failed to seed ${role} user`);
    result[role] = user;
  }
  return result;
}

export async function createBoard(
  request: APIRequestContext,
  owner: SeedUser,
  title: string,
): Promise<{ id: string }> {
  const body = await apiCall<unknown>(request, 'POST', '/boards', {
    token: owner.accessToken,
    data: { title, template: 'blank' },
  });
  const board = asRecord(unwrap<unknown>(body, 'board') ?? body);
  const id = board['id'];
  if (typeof id !== 'string')
    throw new Error(`Create board response has no id: ${JSON.stringify(body)}`);
  return { id };
}

/** Grants a role using whichever member-management route the server exposes. */
export async function grantBoardRole(
  request: APIRequestContext,
  owner: SeedUser,
  boardId: string,
  user: SeedUser,
  role: 'EDITOR' | 'COMMENTER' | 'VIEWER',
): Promise<void> {
  const candidates: Array<{ method: 'POST' | 'PUT' | 'PATCH'; path: string; data: unknown }> = [
    { method: 'POST', path: `/boards/${boardId}/members`, data: { email: user.email, role } },
    { method: 'POST', path: `/boards/${boardId}/members`, data: { username: user.username, role } },
    { method: 'POST', path: `/boards/${boardId}/invites`, data: { email: user.email, role } },
    { method: 'POST', path: `/boards/${boardId}/invitations`, data: { email: user.email, role } },
    { method: 'POST', path: `/boards/${boardId}/share`, data: { email: user.email, role } },
  ];
  if (user.id) {
    candidates.push({
      method: 'PUT',
      path: `/boards/${boardId}/members/${user.id}`,
      data: { role },
    });
  }

  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      await apiCall(request, candidate.method, candidate.path, {
        token: owner.accessToken,
        data: candidate.data,
      });
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`Could not grant ${role} on ${boardId}: ${errors.join(' | ')}`);
}

export async function getWsTicket(
  request: APIRequestContext,
  user: SeedUser,
  boardId: string,
): Promise<string> {
  const body = await apiCall<unknown>(request, 'POST', `/boards/${boardId}/ws-ticket`, {
    token: user.accessToken,
  });
  const ticket = unwrap<string>(body, 'ticket');
  if (!ticket) throw new Error(`WS ticket response has no ticket: ${JSON.stringify(body)}`);
  return ticket;
}

export function boardSocketUrl(boardId: string, ticket: string): string {
  return `${WS_ORIGIN}/ws/boards/${boardId}?ticket=${encodeURIComponent(ticket)}`;
}

/* ------------------------------------------------------------------ *
 * UI helpers
 * ------------------------------------------------------------------ */

export async function signIn(page: Page, user: SeedUser): Promise<void> {
  await page.goto('/login');
  const identifier = page
    .locator(
      [
        'input[name="identifier"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[type="email"]',
        'input[autocomplete="username"]',
      ].join(', '),
    )
    .first();
  await identifier.fill(user.email, { timeout: 15_000 });
  await page.locator('input[type="password"]').first().fill(user.password);
  await page
    .getByRole('button', { name: /sign in|log in|continue/i })
    .first()
    .click();
  await expect(page).not.toHaveURL(/\/login([/?#]|$)/, { timeout: 20_000 });
}

export async function openBoard(page: Page, boardId: string): Promise<void> {
  for (const path of [`/board/${boardId}`, `/boards/${boardId}`]) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    if (response?.ok()) break;
  }
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
  // Let the Yjs handshake and initial snapshot hydration settle.
  await page.waitForTimeout(450);
}

const TOOL_SELECTORS: Record<string, { label: string; shortcut: string }> = {
  select: { label: 'Select', shortcut: 'v' },
  rectangle: { label: 'Rectangle', shortcut: 'r' },
  ellipse: { label: 'Ellipse', shortcut: 'o' },
  arrow: { label: 'Arrow', shortcut: 'a' },
};

export async function selectTool(page: Page, tool: keyof typeof TOOL_SELECTORS): Promise<void> {
  const config = TOOL_SELECTORS[tool];
  const button = page
    .locator(
      `[data-testid="tool-${config.label.toLowerCase()}"], button[aria-label="${config.label}"], button[title="${config.label}"]`,
    )
    .first();
  if ((await button.count()) > 0) {
    await button.click();
  } else {
    await page.keyboard.press(config.shortcut);
  }
}

function canvasPoint(box: { x: number; y: number }, point: CanvasPoint): CanvasPoint {
  return { x: box.x + point.x, y: box.y + point.y };
}

async function canvasBox(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('Konva canvas has no bounding box');
  return box;
}

/** Draws a rectangle using real pointer events; coordinates are canvas-relative. */
export async function drawRectangle(page: Page, from: CanvasPoint, to: CanvasPoint): Promise<void> {
  await selectTool(page, 'rectangle');
  const box = await canvasBox(page);
  const start = canvasPoint(box, from);
  const end = canvasPoint(box, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 14 });
  await page.mouse.up();
  await selectTool(page, 'select');
}

/** Drags whatever is at `from` in canvas-relative coordinates to `to`. */
export async function dragOnCanvas(page: Page, from: CanvasPoint, to: CanvasPoint): Promise<void> {
  await selectTool(page, 'select');
  const box = await canvasBox(page);
  const start = canvasPoint(box, from);
  const end = canvasPoint(box, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 18 });
  await page.mouse.up();
}

export async function attemptUiMutation(page: Page): Promise<void> {
  try {
    await drawRectangle(page, { x: 180, y: 160 }, { x: 300, y: 250 });
  } catch {
    // A read-only canvas legitimately refuses the tool activation.
  }
}

/* ------------------------------------------------------------------ *
 * Document state observation
 * ------------------------------------------------------------------ */

export function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hashElements(elements: ElementState): string {
  return createHash('sha256').update(canonicalStringify(elements)).digest('hex');
}

export interface BoardObserver {
  readonly elements: () => ElementState;
  readonly waitFor: (
    predicate: (elements: ElementState) => boolean,
    timeoutMs: number,
  ) => Promise<ElementState>;
  readonly close: () => void;
}

/** Independent, read-only Yjs client used as the convergence oracle. */
export async function connectBoardObserver(
  request: APIRequestContext,
  user: SeedUser,
  boardId: string,
): Promise<BoardObserver> {
  const ticket = await getWsTicket(request, user, boardId);
  const socket = new WebSocket(boardSocketUrl(boardId, ticket));
  socket.binaryType = 'arraybuffer';
  const doc = new Y.Doc();

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Observer WS handshake timed out')), 15_000);
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`Observer WS error on ${boardId}`));
    });
    socket.addEventListener('open', () => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0); // messageSync
      syncProtocol.writeSyncStep1(encoder, doc);
      socket.send(encoding.toUint8Array(encoder));
      resolve();
    });
    socket.addEventListener('message', (event: MessageEvent) => {
      const bytes = new Uint8Array(event.data as ArrayBuffer);
      try {
        const decoder = decoding.createDecoder(bytes);
        const messageType = encoding.readVarUint(decoder);
        if (messageType === 0) {
          const reply = encoding.createEncoder();
          encoding.writeVarUint(reply, 0);
          syncProtocol.readSyncMessage(decoder, reply, doc, 'e2e-observer');
          if (encoding.length(reply) > 1) socket.send(encoding.toUint8Array(reply));
        }
      } catch {
        // Ignore malformed frames; the guard test intentionally sends some.
      }
    });
  });

  const elements = (): ElementState => doc.getMap('elements').toJSON() as ElementState;

  return {
    elements,
    waitFor: async (predicate, timeoutMs) => {
      const deadline = Date.now() + timeoutMs;
      let last: ElementState = elements();
      while (Date.now() < deadline) {
        last = elements();
        if (predicate(last)) return last;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(
        `Observer condition not met in ${timeoutMs}ms. State: ${canonicalStringify(last).slice(0, 1200)}`,
      );
    },
    close: () => {
      doc.destroy();
      socket.close();
    },
  };
}

interface PageState {
  elements: ElementState | null;
  source: 'hook' | 'dom' | 'indexeddb' | 'unavailable';
}

async function readIndexedDbUpdates(page: Page, boardId: string): Promise<number[][]> {
  try {
    return await page.evaluate(async (wantedBoardId: string) => {
      const databases = await indexedDB.databases();
      const collect = async (onlyMatchingBoard: boolean): Promise<number[][]> => {
        const updates: number[][] = [];
        for (const info of databases) {
          const name = info.name;
          if (!name) continue;
          if (onlyMatchingBoard && !name.includes(wantedBoardId)) continue;
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(name);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          try {
            if (!db.objectStoreNames.contains('updates')) continue;
            const values = await new Promise<unknown[]>((resolve, reject) => {
              const request = db.transaction('updates', 'readonly').objectStore('updates').getAll();
              request.onsuccess = () => resolve(request.result ?? []);
              request.onerror = () => reject(request.error);
            });
            for (const value of values) {
              if (value instanceof Uint8Array) updates.push(Array.from(value));
              else if (value instanceof ArrayBuffer)
                updates.push(Array.from(new Uint8Array(value)));
            }
          } finally {
            db.close();
          }
        }
        return updates;
      };

      // Prefer the board's own persistence db; a shared db name is a valid fallback.
      const scoped = await collect(true);
      return scoped.length > 0 ? scoped : collect(false);
    }, boardId);
  } catch {
    return [];
  }
}

/**
 * Reads the board's element map from the browser itself when possible.
 * Falls back to replaying the client's IndexedDB Yjs update log in Node.
 */
export async function readPageElements(page: Page, boardId: string): Promise<PageState> {
  const hook = await page.evaluate(() => {
    const scope = globalThis as unknown as {
      __syncboard?: { getElements?: () => unknown };
      __syncboardDebug?: { getElements?: () => unknown };
    };
    const value = scope.__syncboard?.getElements?.() ?? scope.__syncboardDebug?.getElements?.();
    return value ?? null;
  });
  if (hook && typeof hook === 'object') {
    return { elements: hook as ElementState, source: 'hook' };
  }

  const domState = await page.evaluate(() => {
    const node = document.querySelector('[data-testid="board-elements"]');
    if (!node) return null;
    try {
      return JSON.parse(node.textContent ?? 'null') as unknown;
    } catch {
      return null;
    }
  });
  if (domState && typeof domState === 'object' && !Array.isArray(domState)) {
    return { elements: domState as ElementState, source: 'dom' };
  }

  const rawUpdates = await readIndexedDbUpdates(page, boardId);
  if (rawUpdates.length > 0) {
    const doc = new Y.Doc();
    for (const bytes of rawUpdates) {
      try {
        Y.applyUpdate(doc, new Uint8Array(bytes), 'e2e-indexeddb');
      } catch {
        // Mixed db names can yield unrelated updates; ignore them.
      }
    }
    const elements = doc.getMap('elements').toJSON() as ElementState;
    doc.destroy();
    if (Object.keys(elements).length > 0) return { elements, source: 'indexeddb' };
  }

  return { elements: null, source: 'unavailable' };
}

export async function waitForPageElements(
  page: Page,
  boardId: string,
  predicate: (elements: ElementState) => boolean,
  timeoutMs: number,
): Promise<{ seen: boolean; elapsedMs: number; source: PageState['source'] }> {
  const startedAt = Date.now();
  let source: PageState['source'] = 'unavailable';
  while (Date.now() - startedAt < timeoutMs) {
    const state = await readPageElements(page, boardId);
    source = state.source;
    if (state.elements && predicate(state.elements)) {
      return { seen: true, elapsedMs: Date.now() - startedAt, source };
    }
    await page.waitForTimeout(25);
  }
  return { seen: false, elapsedMs: Date.now() - startedAt, source };
}

/* ------------------------------------------------------------------ *
 * Raw WebSocket frame injection (viewer RBAC regression)
 * ------------------------------------------------------------------ */

export async function craftElementInsertFrame(elementId: string): Promise<Uint8Array> {
  const doc = new Y.Doc();
  const elements = doc.getMap('elements');
  const inner = new Y.Map<unknown>();
  doc.transact(() => {
    inner.set('id', elementId);
    inner.set('type', 'rectangle');
    inner.set('x', 9999);
    inner.set('y', 9999);
    inner.set('width', 120);
    inner.set('height', 80);
    inner.set('rotation', 0);
    inner.set('zIndex', 'zz');
    inner.set('locked', false);
    inner.set('updatedAt', Date.now());
    elements.set(elementId, inner);
  });

  const update = Y.encodeStateAsUpdate(doc);
  const frame = encoding.createEncoder();
  encoding.writeVarUint(frame, 0); // messageSync
  encoding.writeVarUint(frame, syncProtocol.messageYjsUpdate);
  encoding.writeVarUint8Array(frame, update);
  doc.destroy();
  return encoding.toUint8Array(frame);
}

/** Sends a crafted binary Yjs frame from inside the browser over the viewer's ticket. */
export async function injectRawFrame(
  page: Page,
  request: APIRequestContext,
  viewer: SeedUser,
  boardId: string,
  frame: Uint8Array,
): Promise<void> {
  const ticket = await getWsTicket(request, viewer, boardId);
  const url = boardSocketUrl(boardId, ticket);
  const bytes = Array.from(frame);
  await page.evaluate(
    async ({ url: socketUrl, bytes: payload }) => {
      const socket = new WebSocket(socketUrl);
      socket.binaryType = 'arraybuffer';
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('injection socket timed out')), 10_000);
        socket.addEventListener('open', () => {
          clearTimeout(timer);
          resolve();
        });
        socket.addEventListener('error', () => {
          clearTimeout(timer);
          reject(new Error('injection socket error'));
        });
      });
      socket.send(new Uint8Array(payload));
      await new Promise((resolve) => setTimeout(resolve, 400));
      socket.close();
    },
    { url, bytes },
  );
}
