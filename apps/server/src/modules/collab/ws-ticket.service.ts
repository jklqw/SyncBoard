import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Role } from '@prisma/client';
import { wsTicketKey } from '../../common/constants/redis-channels';
import { RedisService } from '../../common/redis/redis.service';
import { PermissionsService } from '../permissions/permissions.service';

/** Atomic GET+DEL so a ticket can be redeemed exactly once. */
const CONSUME_LUA = `
local value = redis.call('GET', KEYS[1])
if value then redis.call('DEL', KEYS[1]) end
return value
`;

export interface WsTicketPayload {
  userId: string;
  boardId: string;
  role: Role;
  issuedAt: number;
  expiresAt: number;
}

export const WS_TICKET_TTL_SECONDS = 60;

@Injectable()
export class WsTicketService {
  constructor(
    private readonly redis: RedisService,
    private readonly permissions: PermissionsService,
  ) {}

  async create(
    userId: string,
    boardId: string,
    shareToken?: string,
  ): Promise<{ ticket: string; expiresIn: number }> {
    const role = await this.permissions.getRole(userId, boardId, shareToken);
    if (!role) throw new ForbiddenException('No access to this board');

    const ticket = randomBytes(32).toString('base64url');
    const now = Date.now();
    const payload: WsTicketPayload = {
      userId,
      boardId,
      role,
      issuedAt: now,
      expiresAt: now + WS_TICKET_TTL_SECONDS * 1000,
    };
    await this.redis.client.set(
      wsTicketKey(ticket),
      JSON.stringify(payload),
      'EX',
      WS_TICKET_TTL_SECONDS,
      'NX',
    );
    return { ticket, expiresIn: WS_TICKET_TTL_SECONDS };
  }

  async consume(ticket: string, boardId: string): Promise<WsTicketPayload | null> {
    const raw = (await this.redis.client.eval(
      CONSUME_LUA,
      1,
      wsTicketKey(ticket),
    )) as string | null;
    if (!raw) return null;

    try {
      const payload = JSON.parse(raw) as WsTicketPayload;
      if (payload.boardId !== boardId) return null;
      if (payload.expiresAt <= Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }
}
