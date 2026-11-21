import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA = 'syncboard:rate-limit';

export interface RateLimitOptions {
  /** Redis key prefix, e.g. `auth:login`. */
  keyPrefix: string;
  limit: number;
  windowMs: number;
  /** Optional body field appended to the key (e.g. `identifier`). */
  keyFromBody?: string;
}

export function RateLimit(options: RateLimitOptions): MethodDecorator & ClassDecorator {
  return SetMetadata(RATE_LIMIT_METADATA, options) as MethodDecorator & ClassDecorator;
}
