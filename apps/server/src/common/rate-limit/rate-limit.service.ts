import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

/** Atomic Redis sliding-window log. Returns { allowed, remaining, retrySeconds }. */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)

if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return { 1, limit - count - 1, 0 }
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local retry = math.ceil(window / 1000)
if oldest[2] then
  retry = math.max(1, math.ceil((tonumber(oldest[2]) + window - now) / 1000))
end
return { 0, 0, retry }
`;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetSeconds: number;
}

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const raw = (await this.redis.client.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      String(Date.now()),
      String(windowMs),
      String(limit),
      randomUUID(),
    )) as [number, number, number];

    return {
      allowed: raw[0] === 1,
      limit,
      remaining: raw[1],
      retryAfterSeconds: raw[2],
      resetSeconds: Math.ceil(windowMs / 1000),
    };
  }
}
