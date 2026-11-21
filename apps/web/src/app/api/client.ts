/** Minimal typed fetch client: access token in memory, HttpOnly refresh cookie on the wire. */

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const API_BASE = `${API_URL.replace(/\/$/, '')}/api/v1`;

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let shareToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Share-link token appended to board-scoped REST calls (never to /auth). */
export function setShareToken(token: string | null): void {
  shareToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ErrorBody {
  message?: string | string[];
  error?: string;
  code?: string;
}

function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return Promise.resolve(undefined);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return response.text();
  return response.json();
}

function messageFrom(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null) return fallback;
  const error = body as ErrorBody;
  if (Array.isArray(error.message)) return error.message.join(', ');
  return error.message ?? error.error ?? fallback;
}

/** One shared promise so concurrent 401s cannot trigger a refresh stampede. */
export function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        setAccessToken(null);
        return false;
      }
      const body = (await parseBody(response)) as { accessToken?: string } | undefined;
      if (!body?.accessToken) return false;
      setAccessToken(body.accessToken);
      return true;
    })
    .catch(() => {
      setAccessToken(null);
      return false;
    })
    .finally(() => {
      // Release on the next microtask so all waiters observe the same result.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    });
  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip the automatic refresh attempt (used by auth endpoints themselves). */
  skipRefresh?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipRefresh = false, headers, ...rest } = options;
  const resolvedHeaders = new Headers(headers);
  if (accessToken) resolvedHeaders.set('Authorization', `Bearer ${accessToken}`);
  if (body !== undefined && !(body instanceof FormData)) {
    resolvedHeaders.set('Content-Type', 'application/json');
  }

  let resolvedPath = path;
  if (shareToken && path.startsWith('/boards/')) {
    resolvedPath += `${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(shareToken)}`;
  }

  const send = (): Promise<Response> =>
    fetch(`${API_BASE}${resolvedPath}`, {
      ...rest,
      credentials: 'include',
      headers: resolvedHeaders,
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await send();
  if (response.status === 401 && !skipRefresh && !path.startsWith('/auth/')) {
    if (await refreshAccessToken()) response = await send();
  }

  const parsed = await parseBody(response);
  if (!response.ok) {
    const code = typeof parsed === 'object' && parsed !== null ? (parsed as ErrorBody).code ?? null : null;
    throw new ApiError(messageFrom(parsed, `Request failed (${response.status})`), response.status, code);
  }
  return parsed as T;
}

export function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}
