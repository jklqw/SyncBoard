#!/usr/bin/env node
/**
 * SyncBoard — 25-user CRDT collaboration stress harness (plain Node.js, no build step).
 *
 * What it does
 *   1. Authenticates one owner, creates (or reuses) a board, and mints one *single-use*
 *      WebSocket ticket per simulated client.
 *   2. Opens 25 independent binary WebSocket connections to /ws/boards/:boardId.
 *   3. Performs the real Yjs Sync Step 1/2 handshake on every connection.
 *   4. Broadcasts cursor awareness at 20 Hz and concurrently creates/moves rectangles
 *      on every connection for STRESS_DURATION_MS.
 *   5. Measures end-to-end broadcast latency (p50/p95), then verifies that all clients'
 *      canonical SHA-256 element-state hashes are identical after a quiet period.
 *
 * Usage
 *   node tests/load/collab-stress.js
 *   STRESS_DURATION_MS=10000 node tests/load/collab-stress.js   # CI smoke run
 *   STRESS_BOARD_ID=<uuid> node tests/load/collab-stress.js     # reuse an existing board
 *   STRESS_USERS='a@x.test:pw,b@x.test:pw' node tests/load/collab-stress.js
 *
 * Environment
 *   STRESS_API_URL          REST/WS base URL          (default http://localhost:3000)
 *   STRESS_BOARD_ID         existing board id         (default: create a temporary board)
 *   STRESS_OWNER_EMAIL      account used by default    (default loadtest@syncboard.test)
 *   STRESS_OWNER_PASSWORD   account password           (default LoadTest!2026)
 *   STRESS_USERS            comma-separated email:password accounts (one per client if given)
 *   STRESS_CLIENTS          simulated clients          (default 25)
 *   STRESS_DURATION_MS      active test duration      (default 60000, 10000 when CI=1)
 *   STRESS_SETTLE_MS        convergence quiet period   (default 3000)
 *   STRESS_CURSOR_HZ        awareness broadcast rate   (default 20)
 *   STRESS_MUTATION_MS      shape mutation interval    (default 250)
 *   STRESS_CONNECT_TIMEOUT_MS  per-socket timeout      (default 12000)
 *
 * Requires (root devDependencies): yjs, y-protocols, lib0, ws.
 * Exits 1 if any socket fails to connect or if convergence is below 100%.
 */
'use strict';

const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const API_BASE = process.env.STRESS_API_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1';
const WS_ORIGIN = API_BASE.replace(/^http/, 'ws');
const BOARD_ID = process.env.STRESS_BOARD_ID || '';
const CLIENTS = Number(process.env.STRESS_CLIENTS || '25');
const DURATION_MS = Number(process.env.STRESS_DURATION_MS || (process.env.CI ? '10000' : '60000'));
const SETTLE_MS = Number(process.env.STRESS_SETTLE_MS || '3000');
const CURSOR_HZ = Number(process.env.STRESS_CURSOR_HZ || '20');
const MUTATION_MS = Number(process.env.STRESS_MUTATION_MS || '250');
const CONNECT_TIMEOUT_MS = Number(process.env.STRESS_CONNECT_TIMEOUT_MS || '12000');
const OWNER_EMAIL = process.env.STRESS_OWNER_EMAIL || 'loadtest@syncboard.test';
const OWNER_PASSWORD = process.env.STRESS_OWNER_PASSWORD || 'LoadTest!2026';

const REMOTE = 'stress-remote';
const LOCAL = 'stress-local';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function log(...args) {
  process.stdout.write(`[${nowIso()}] ${args.join(' ')}\n`);
}

function fail(message) {
  process.stderr.write(`[${nowIso()}] ERROR ${message}\n`);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) === undefined ? 'null' : JSON.stringify(value);
}

function hashElements(doc) {
  return createHash('sha256')
    .update(canonical(doc.getMap('elements').toJSON()))
    .digest('hex');
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}

function dockerStats() {
  try {
    return execFileSync(
      'docker',
      ['stats', '--no-stream', '--format', '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}}'],
      { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    return 'unavailable (docker stats not accessible from this shell)';
  }
}

async function api(method, path, { token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${API_PREFIX}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok)
    throw new Error(`${method} ${path} -> ${response.status()} ${text.slice(0, 400)}`);
  return payload;
}

function unwrap(payload, key) {
  if (!payload || typeof payload !== 'object') return undefined;
  return payload[key] ?? payload.data?.[key];
}

async function authenticate(email, password) {
  let payload;
  try {
    payload = await api('POST', '/auth/login', {
      body: { identifier: email, password },
    });
  } catch (error) {
    if (!/40[014]/.test(String(error.message))) throw error;
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '-');
    payload = await api('POST', '/auth/register', {
      body: { email, username, displayName: username, password },
    });
  }
  const token = unwrap(payload, 'accessToken') || unwrap(payload, 'token');
  if (!token) throw new Error(`No access token returned for ${email}`);
  return { email, password, token };
}

function parseAccounts() {
  const raw = process.env.STRESS_USERS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(':');
      if (separator < 1) throw new Error(`Invalid STRESS_USERS entry: ${entry}`);
      return { email: entry.slice(0, separator), password: entry.slice(separator + 1) };
    });
}

async function mintTicket(account, boardId) {
  const payload = await api('POST', `/boards/${boardId}/ws-ticket`, { token: account.token });
  const ticket = unwrap(payload, 'ticket');
  if (!ticket) throw new Error(`No WS ticket returned for ${account.email}`);
  return ticket;
}

async function main() {
  const [Y, syncProtocol, awarenessProtocol, encoding, decoding, wsModule] = await Promise.all([
    import('yjs'),
    import('y-protocols/sync'),
    import('y-protocols/awareness'),
    import('lib0/encoding'),
    import('lib0/decoding'),
    import('ws'),
  ]);
  const WebSocket = wsModule.default || wsModule.WebSocket || wsModule;

  if (!Number.isFinite(CLIENTS) || CLIENTS < 1) throw new Error('STRESS_CLIENTS must be positive');
  if (!Number.isFinite(DURATION_MS) || DURATION_MS < 1000) {
    throw new Error('STRESS_DURATION_MS must be >= 1000');
  }

  const accounts = parseAccounts();
  const owner = await authenticate(
    accounts[0]?.email || OWNER_EMAIL,
    accounts[0]?.password || OWNER_PASSWORD,
  );
  log(`Authenticated sandbox account ${owner.email}`);

  let boardId = BOARD_ID;
  if (!boardId) {
    const created = await api('POST', '/boards', {
      token: owner.token,
      body: { title: `Load test ${Date.now()}`, template: 'blank' },
    });
    boardId = unwrap(created, 'id') || created?.id;
    if (!boardId) throw new Error(`Could not create board: ${JSON.stringify(created)}`);
  }
  log(`Board ${boardId} | ${CLIENTS} clients | ${DURATION_MS}ms | cursors ${CURSOR_HZ}Hz`);

  const state = {
    clients: [],
    stopped: false,
    allLatencies: [],
  };

  function openSocket(client) {
    return new Promise((resolve, reject) => {
      mintTicket(client.account, boardId)
        .then((ticket) => {
          const url = `${WS_ORIGIN}/ws/boards/${boardId}?ticket=${encodeURIComponent(ticket)}`;
          const socket = new WebSocket(url);
          socket.binaryType = 'arraybuffer';
          client.socket = socket;

          const timer = setTimeout(
            () => reject(new Error(`client ${client.index} connect timeout`)),
            CONNECT_TIMEOUT_MS,
          );
          socket.once('open', () => {
            clearTimeout(timer);
            const hello = encoding.createEncoder();
            encoding.writeVarUint(hello, 0); // messageSync
            syncProtocol.writeSyncStep1(hello, client.doc);
            socket.send(encoding.toUint8Array(hello));
            client.connected = true;
            resolve();
          });
          socket.once('error', (error) => {
            clearTimeout(timer);
            reject(new Error(`client ${client.index} socket error: ${error.message}`));
          });
          socket.on('error', (error) => {
            if (client.connected) fail(`client ${client.index} socket error: ${error.message}`);
          });
          socket.on('message', (data) => {
            const bytes = new Uint8Array(data);
            try {
              const decoder = decoding.createDecoder(bytes);
              const type = encoding.readVarUint(decoder);
              if (type === 0) {
                const reply = encoding.createEncoder();
                encoding.writeVarUint(reply, 0);
                syncProtocol.readSyncMessage(decoder, reply, client.doc, REMOTE);
                if (encoding.length(reply) > 1) socket.send(encoding.toUint8Array(reply));
              } else if (type === 1) {
                awarenessProtocol.applyAwarenessUpdate(
                  client.awareness,
                  decoding.readVarUint8Array(decoder),
                  REMOTE,
                );
              }
            } catch (error) {
              client.decodeErrors += 1;
              if (client.decodeErrors === 1) {
                fail(`client ${client.index} ignored a malformed frame: ${error.message}`);
              }
            }
          });
          socket.on('close', () => {
            client.connected = false;
            if (!state.stopped) {
              log(`client ${client.index} disconnected; reconnecting with a fresh ticket`);
              setTimeout(() => {
                openSocket(client).catch((error) => fail(error.message));
              }, 500);
            }
          });
        })
        .catch(reject);
    });
  }

  function createClient(index, account) {
    const doc = new Y.Doc();
    const elements = doc.getMap('elements');
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalStateField('user', {
      name: `Load ${index + 1}`,
      color: '#2563EB',
    });

    const client = {
      index,
      account,
      doc,
      elements,
      awareness,
      socket: null,
      connected: false,
      decodeErrors: 0,
      pending: new Map(),
      latencies: [],
      created: [],
      sequence: 0,
      timers: [],
    };

    elements.observeDeep((events) => {
      for (const event of events) {
        if (!event.keysChanged || typeof event.keysChanged.keys !== 'function') continue;
        for (const id of event.keysChanged.keys()) {
          const value = elements.get(id);
          if (!value || typeof value.toJSON !== 'function') continue;
          const marker = value.toJSON().zIndex;
          if (typeof marker !== 'string' || !client.pending.has(marker)) continue;
          const latency = Date.now() - client.pending.get(marker);
          client.latencies.push(latency);
          state.allLatencies.push(latency);
          client.pending.delete(marker);
        }
      }
    });

    return client;
  }

  function mutate(client) {
    client.sequence += 1;
    const sequence = client.sequence;
    const isMove = client.created.length > 0 && Math.random() < 0.55;
    const id = isMove
      ? client.created[Math.floor(Math.random() * client.created.length)]
      : `stress-${client.index}-${sequence}`;
    if (!isMove) client.created.push(id);
    const existing = client.elements.has(id) ? client.elements.get(id).toJSON() : null;
    const marker = `s${client.index}-${sequence}`;
    const inner = new Y.Map();

    client.doc.transact(() => {
      inner.set('id', id);
      inner.set('type', 'rectangle');
      inner.set(
        'x',
        existing
          ? Number(existing.x) + (Math.random() - 0.5) * 40
          : 120 + ((sequence * 37 + client.index * 53) % 900),
      );
      inner.set(
        'y',
        existing
          ? Number(existing.y) + (Math.random() - 0.5) * 40
          : 120 + ((sequence * 61 + client.index * 29) % 560),
      );
      inner.set('width', 90);
      inner.set('height', 60);
      inner.set('rotation', 0);
      // zIndex is a schema-valid string; reuse it as an end-to-end latency marker.
      inner.set('zIndex', marker);
      inner.set('locked', false);
      inner.set('updatedAt', Date.now());
      inner.set('style', {
        fill: '#FAF9F6',
        stroke: '#2563EB',
        strokeWidth: 2,
        opacity: 1,
        roughness: 0,
      });
      client.elements.set(id, inner);
    }, LOCAL);

    client.pending.set(marker, Date.now());
  }

  const startingStats = dockerStats();
  for (let index = 0; index < CLIENTS; index += 1) {
    const account = accounts[index] || owner;
    const client = createClient(index, account);
    await openSocket(client);
    state.clients.push(client);
    if ((index + 1) % 5 === 0 || index + 1 === CLIENTS)
      log(`Connected ${index + 1}/${CLIENTS} clients`);
  }

  for (const client of state.clients) {
    let tick = 0;
    client.timers.push(
      setInterval(
        () => {
          if (!client.connected || !client.socket || state.stopped) return;
          tick += 1;
          const x = 200 + Math.round(300 * Math.sin((tick + client.index) / 7));
          const y = 200 + Math.round(180 * Math.cos((tick + client.index) / 5));
          client.awareness.setLocalStateField('cursor', { x, y });
          const frame = encoding.createEncoder();
          encoding.writeVarUint(frame, 1); // messageAwareness
          encoding.writeVarUint8Array(
            frame,
            awarenessProtocol.encodeAwarenessUpdate(client.awareness, [client.doc.clientID]),
          );
          client.socket.send(encoding.toUint8Array(frame));
        },
        Math.max(10, Math.round(1000 / CURSOR_HZ)),
      ),
    );

    client.timers.push(
      setInterval(() => {
        if (!client.connected || state.stopped) return;
        mutate(client);
      }, MUTATION_MS),
    );
  }

  log(`Active phase started (${DURATION_MS}ms)`);
  await sleep(DURATION_MS);
  state.stopped = true;
  for (const client of state.clients) {
    for (const timer of client.timers) clearInterval(timer);
  }
  log(`Quiet period (${SETTLE_MS}ms)`);
  await sleep(SETTLE_MS);

  const hashes = state.clients.map((client) => hashElements(client.doc));
  const unique = new Set(hashes);
  const connected = state.clients.filter((client) => client.connected).length;
  const sorted = [...state.allLatencies].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);

  log('');
  log('=== SyncBoard load test summary ===');
  log(`clients connected: ${connected}/${CLIENTS}`);
  log(`broadcast latency: p50=${p50}ms p95=${p95}ms samples=${sorted.length}`);
  log(
    `convergence:       ${unique.size === 1 ? `${CLIENTS}/${CLIENTS} identical (100%)` : `FAILED (${unique.size} distinct states)}`}`,
  );
  log('per-client element-state hashes:');
  hashes.forEach((hash, index) => log(`  client ${String(index + 1).padStart(2, '0')} ${hash}`));
  log('container resource sample (start):');
  log(startingStats || 'unavailable');
  log('container resource sample (end):');
  log(dockerStats());
  log('database writes: debounced snapshots at 3s / 15s ceiling (see ENGINEERING_REPORT.md)');
  log(
    `RESULT ${JSON.stringify({
      clients: CLIENTS,
      connected,
      durationMs: DURATION_MS,
      latencySamples: sorted.length,
      p50Ms: p50,
      p95Ms: p95,
      distinctStateHashes: unique.size,
      convergencePercent: unique.size === 1 ? 100 : 0,
      stateHash: unique.size === 1 ? hashes[0] : null,
    })}`,
  );

  for (const client of state.clients) {
    client.awareness.destroy();
    client.socket?.close();
    client.doc.destroy();
  }

  if (connected !== CLIENTS || unique.size !== 1) process.exitCode = 1;
}

main().catch((error) => {
  fail(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
