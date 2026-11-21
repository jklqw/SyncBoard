import { z } from 'zod';

/**
 * Single source of truth for server configuration.
 *
 * Every value is validated at bootstrap (fail fast) — no secret ever falls back
 * to a hard-coded default. `NODE_ENV=production` additionally rejects the
 * placeholder values shipped in `.env.example`.
 */

const booleanString = z
  .string()
  .default('false')
  .transform((value) => ['true', '1', 'yes', 'on'].includes(value.toLowerCase()));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.string().min(1).default('info'),

  CORS_ORIGIN: z.string().min(1),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),
  REFRESH_COOKIE_PATH: z.string().min(1).default('/api/v1/auth'),

  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().min(1).max(65535).default(9000),
  MINIO_USE_SSL: booleanString,
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default('syncboard-media'),
  MINIO_PUBLIC_URL: z.string().url(),

  MAX_DOCUMENT_BYTES: z.coerce.number().int().positive().default(8 * 1024 * 1024),
  MAX_WS_FRAME_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
});

export type Env = z.infer<typeof envSchema>;

const SECRET_KEYS = new Set<keyof Env>([
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
]);

const PLACEHOLDER_PATTERN =
  /^(replace|change|changeme|your[_-]?|placeholder|example|dummy|todo|test|secret|xxx|password)/i;

export function parseEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid server environment configuration: ${details}`);
  }

  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    for (const key of SECRET_KEYS) {
      const value = String(env[key]);
      if (PLACEHOLDER_PATTERN.test(value) || value.length < 32) {
        throw new Error(
          `Refusing to start in production with a placeholder or short ${key}.`,
        );
      }
    }
    for (const key of ['DATABASE_URL', 'REDIS_URL', 'CORS_ORIGIN'] as const) {
      if (PLACEHOLDER_PATTERN.test(env[key])) {
        throw new Error(`Refusing to start in production with placeholder ${key}.`);
      }
    }
  }

  return env;
}

/** Shape expected by Nest's ConfigModule `validate` hook. */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  return parseEnv(config) as unknown as Record<string, unknown>;
}

/** Direct accessor for providers that receive the `ENV` injection token. */
export function getEnv(): Env {
  return parseEnv(process.env as Record<string, unknown>);
}

/** DI token for the validated, typed environment. */
export const ENV = 'SYNCBOARD_ENV';

/** Split a comma separated CORS allowlist into normalised origins. */
export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}

/** Convert an HTTP origin into its websocket counterpart for CSP connect-src. */
export function toWsOrigin(httpOrigin: string): string {
  if (httpOrigin.startsWith('https://')) {
    return `wss://${httpOrigin.slice('https://'.length)}`;
  }
  if (httpOrigin.startsWith('http://')) {
    return `ws://${httpOrigin.slice('http://'.length)}`;
  }
  return httpOrigin;
}

/** Parse a duration like `7d`, `15m`, `30s` into milliseconds. */
export function ttlToMilliseconds(ttl: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(ttl.trim());
  if (!match) {
    throw new Error(`Unsupported TTL value: ${ttl}`);
  }
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? 's';
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit] ?? 1000);
}
