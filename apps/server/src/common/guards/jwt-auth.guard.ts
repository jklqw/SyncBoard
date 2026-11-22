import { createHash } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ENV, type Env } from '../config/env.schema';
import { revokedFamilyKey } from '../constants/redis-channels';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { setRequestUser, type AuthenticatedUser } from '../types';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  username: string;
  fam: string;
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Watch links must work without an account. Only the two board-scoped read
   * endpoints needed to boot a guest session accept a bare share token; every
   * mutating route still requires a real access token and board role.
   */
  private tryGuestShareAccess(req: Request): AuthenticatedUser | null {
    const query = req.query as Record<string, unknown>;
    const shareToken = query.token ?? query.shareToken;
    if (typeof shareToken !== 'string' || shareToken.length < 16) return null;

    const route = (req.route as { path?: string } | undefined)?.path ?? '';
    const readOnlyRoute =
      (req.method === 'GET' && route.endsWith('/:id')) ||
      (req.method === 'POST' && route.endsWith('/:id/ws-ticket'));
    if (!readOnlyRoute) return null;

    const id = createHash('sha256').update(shareToken).digest('hex').slice(0, 24);
    return {
      id: `guest_${id}`,
      email: '',
      username: 'guest',
      displayName: 'Guest',
      avatarColor: '#6B8CAE',
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(req);
    if (!token) {
      const guest = this.tryGuestShareAccess(req);
      if (guest) {
        setRequestUser(req, guest);
        return true;
      }
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (payload.fam) {
      const revoked = await this.redis.client.exists(revokedFamilyKey(payload.fam));
      if (revoked > 0) {
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarColor: true,
      },
    });
    if (!user) throw new UnauthorizedException('Unknown account');

    setRequestUser(req, user as AuthenticatedUser);
    return true;
  }
}
