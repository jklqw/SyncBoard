import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  RATE_LIMIT_METADATA,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { clientIp } from '../types';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    let key = `${options.keyPrefix}:${clientIp(req) ?? 'unknown'}`;
    if (options.keyFromBody) {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const field = body[options.keyFromBody];
      if (typeof field === 'string' && field.length > 0) {
        key += `:${field.toLowerCase()}`;
      }
    }

    const result = await this.rateLimit.consume(
      key,
      options.limit,
      options.windowMs,
    );

    res.setHeader('X-RateLimit-Limit', String(result.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(result.resetSeconds));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too Many Requests',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
