import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Request, Response } from 'express';
import { ENV, ttlToMilliseconds, type Env } from '../../common/config/env.schema';
import { revokedFamilyKey } from '../../common/constants/redis-channels';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { clientIp, userAgent } from '../../common/types';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './cookies';
import type { LoginDto, RegisterDto } from './dto/auth.dto';
import { toPublicUser, type PublicUser } from './public-user';
import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard';

const AVATAR_COLORS = [
  '#5B8E7D',
  '#4C6FA8',
  '#9A6A4F',
  '#7A6BA8',
  '#A85D6B',
  '#4F7C8A',
] as const;

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} as const;

interface UserRow {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
  passwordHash: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function chooseAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i += 1) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async register(dto: RegisterDto, req: Request, res: Response): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim();
    const displayName = dto.displayName.trim();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email or username is already registered');
    }

    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTIONS);
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
        avatarColor: chooseAvatarColor(username),
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarColor: true,
      },
    });

    await this.audit.log('AUTH_REGISTER', {
      actorId: user.id,
      ipAddress: clientIp(req),
    });

    const accessToken = await this.issueSession(user, req, res);
    return { user: toPublicUser(user), accessToken };
  }

  async login(dto: LoginDto, req: Request, res: Response): Promise<AuthResult> {
    const identifier = dto.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier.toLowerCase() }, { username: identifier }],
      },
    });

    if (!user) {
      await this.audit.log('AUTH_LOGIN_FAILED', {
        ipAddress: clientIp(req),
        metadata: { identifier, reason: 'unknown_account' },
        severity: 'warn',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      await this.audit.log('AUTH_LOGIN_FAILED', {
        actorId: user.id,
        ipAddress: clientIp(req),
        metadata: { identifier, reason: 'bad_password' },
        severity: 'warn',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.audit.log('AUTH_LOGIN_SUCCESS', {
      actorId: user.id,
      ipAddress: clientIp(req),
    });

    const accessToken = await this.issueSession(user, req, res);
    return { user: toPublicUser(user), accessToken };
  }

  async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
    const token = readRefreshCookie(req);
    if (!token) throw new UnauthorizedException('Missing refresh token');

    const tokenHash = hashToken(token);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record) throw new UnauthorizedException('Invalid refresh token');

    if (record.revokedAt || record.replacedByTokenId) {
      await this.revokeFamily(record.familyId);
      await this.audit.log('AUTH_REFRESH_REUSE_DETECTED', {
        actorId: record.userId,
        ipAddress: clientIp(req),
        metadata: {
          familyId: record.familyId,
          tokenId: record.id,
          userAgent: userAgent(req),
        },
        severity: 'high',
      });
      clearRefreshCookie(res, this.env);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
      clearRefreshCookie(res, this.env);
      throw new UnauthorizedException('Refresh token expired');
    }

    const nextToken = randomBytes(32).toString('base64url');
    const nextHash = hashToken(nextToken);
    const nextRecord = await this.prisma.refreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: nextHash,
        familyId: record.familyId,
        expiresAt: new Date(Date.now() + ttlToMilliseconds(this.env.JWT_REFRESH_TTL)),
        ipAddress: clientIp(req),
        userAgent: userAgent(req),
      },
    });

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedByTokenId: nextRecord.id },
    });

    setRefreshCookie(res, nextToken, this.env);
    const accessToken = await this.signAccess(record.user, record.familyId);
    return { accessToken };
  }

  async logout(req: Request, res: Response): Promise<{ ok: true }> {
    const token = readRefreshCookie(req);
    if (token) {
      const record = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      if (record && !record.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: record.id },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.log('AUTH_LOGOUT', {
        actorId: record?.userId ?? null,
        ipAddress: clientIp(req),
      });
    }
    clearRefreshCookie(res, this.env);
    return { ok: true };
  }

  private async issueSession(
    user: UserRow,
    req: Request,
    res: Response,
  ): Promise<string> {
    const familyId = randomUUID();
    const token = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        familyId,
        expiresAt: new Date(Date.now() + ttlToMilliseconds(this.env.JWT_REFRESH_TTL)),
        ipAddress: clientIp(req),
        userAgent: userAgent(req),
      },
    });
    setRefreshCookie(res, token, this.env);
    return this.signAccess(user, familyId);
  }

  private async signAccess(
    user: Pick<UserRow, 'id' | 'email' | 'username'>,
    familyId: string,
  ): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      fam: familyId,
    };
    return this.jwt.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.JWT_ACCESS_TTL,
    });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.redis.client.set(
      revokedFamilyKey(familyId),
      '1',
      'EX',
      Math.ceil(ttlToMilliseconds(this.env.JWT_REFRESH_TTL) / 1000),
    );
  }
}
