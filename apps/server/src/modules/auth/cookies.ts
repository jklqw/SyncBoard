import type { Request, Response } from 'express';
import { REFRESH_COOKIE_NAME } from '../../common/constants/limits';
import { ttlToMilliseconds, type Env } from '../../common/config/env.schema';

export function setRefreshCookie(
  res: Response,
  token: string,
  env: Env,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: env.REFRESH_COOKIE_PATH,
    maxAge: ttlToMilliseconds(env.JWT_REFRESH_TTL),
  });
}

export function clearRefreshCookie(res: Response, env: Env): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: env.REFRESH_COOKIE_PATH,
  });
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
