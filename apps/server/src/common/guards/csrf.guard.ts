import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ENV, parseCorsOrigins, type Env } from '../config/env.schema';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '../constants/limits';

/**
 * Cookie-authenticated endpoints (refresh/logout) are not "simple" requests:
 * browsers must send a custom header and a same-origin Origin. Both are
 * verified here so a cross-site form cannot replay the refresh cookie.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const origin = req.headers.origin;
    const allowed = parseCorsOrigins(this.env.CORS_ORIGIN);

    if (!origin || !allowed.includes(origin)) {
      throw new ForbiddenException('CSRF check failed: invalid Origin');
    }
    if (req.headers[CSRF_HEADER] !== CSRF_HEADER_VALUE) {
      throw new ForbiddenException('CSRF check failed: missing custom header');
    }
    return true;
  }
}
