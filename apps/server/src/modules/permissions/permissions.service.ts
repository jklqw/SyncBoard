import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Role } from '@prisma/client';
import { revokeChannel } from '../../common/constants/redis-channels';
import { ROLE_RANK } from '../../common/constants/roles';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import type {
  InviteMemberDto,
  ShareLinkDto,
  UpdateMemberRoleDto,
} from './dto/permissions.dto';

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(createHash('sha256').update(a).digest('hex'), 'hex');
  const right = Buffer.from(createHash('sha256').update(b).digest('hex'), 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  /** Resolve the effective role for a user on a board. */
  async getRole(
    userId: string,
    boardId: string,
    shareToken?: string,
  ): Promise<Role | null> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true, shareToken: true, shareRole: true },
    });
    if (!board) return null;
    if (board.ownerId === userId) return Role.OWNER;

    const membership = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
      select: { role: true },
    });
    if (membership) return membership.role;

    if (shareToken && board.shareToken && safeEqualHex(shareToken, board.shareToken)) {
      return board.shareRole;
    }
    return null;
  }

  async listMembers(boardId: string) {
    const members = await this.prisma.boardMember.findMany({
      where: { boardId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatarColor: true,
          },
        },
      },
    });
    return members.map((member) => ({
      userId: member.userId,
      role: member.role,
      email: member.user.email,
      username: member.user.username,
      displayName: member.user.displayName,
      avatarColor: member.user.avatarColor,
    }));
  }

  async invite(
    boardId: string,
    dto: InviteMemberDto,
    actorId: string,
    ipAddress: string | null,
  ) {
    const email = dto.email?.trim().toLowerCase();
    const username = dto.username?.trim();
    if (!email && !username) {
      throw new BadRequestException('Provide an email or a username');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(username ? [{ username }] : []),
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarColor: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });
    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId === user.id) {
      throw new BadRequestException('The board owner already has full access');
    }

    const previous = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: user.id } },
    });
    const member = await this.prisma.boardMember.upsert({
      where: { boardId_userId: { boardId, userId: user.id } },
      create: { boardId, userId: user.id, role: dto.role },
      update: { role: dto.role },
    });

    if (previous && ROLE_RANK[previous.role] > ROLE_RANK[dto.role]) {
      await this.publishRevocation(boardId, user.id, {
        reason: 'role_downgraded',
        newRole: dto.role,
      });
    }

    await this.audit.log('BOARD_MEMBER_INVITED', {
      actorId,
      boardId,
      ipAddress,
      metadata: { userId: user.id, role: dto.role },
    });

    return {
      userId: user.id,
      role: member.role,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
    };
  }

  async changeRole(
    boardId: string,
    userId: string,
    dto: UpdateMemberRoleDto,
    actorId: string,
    ipAddress: string | null,
  ) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });
    if (board?.ownerId === userId) {
      throw new BadRequestException('The owner role cannot be changed');
    }

    const existing = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
    if (!existing) throw new NotFoundException('Membership not found');

    const member = await this.prisma.boardMember.update({
      where: { id: existing.id },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            email: true,
            username: true,
            displayName: true,
            avatarColor: true,
          },
        },
      },
    });

    if (ROLE_RANK[existing.role] > ROLE_RANK[dto.role]) {
      await this.publishRevocation(boardId, userId, {
        reason: 'role_changed',
        newRole: dto.role,
      });
    }

    await this.audit.log('BOARD_MEMBER_ROLE_CHANGED', {
      actorId,
      boardId,
      ipAddress,
      metadata: { userId, from: existing.role, to: dto.role },
    });

    return {
      userId,
      role: member.role,
      email: member.user.email,
      username: member.user.username,
      displayName: member.user.displayName,
      avatarColor: member.user.avatarColor,
    };
  }

  async removeMember(
    boardId: string,
    userId: string,
    actorId: string,
    ipAddress: string | null,
  ): Promise<{ ok: true }> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });
    if (board?.ownerId === userId) {
      throw new BadRequestException('The board owner cannot be removed');
    }

    await this.prisma.boardMember.deleteMany({ where: { boardId, userId } });
    await this.publishRevocation(boardId, userId, { reason: 'access_revoked' });
    await this.audit.log('BOARD_MEMBER_REMOVED', {
      actorId,
      boardId,
      ipAddress,
      metadata: { userId },
    });
    return { ok: true };
  }

  async createShareLink(
    boardId: string,
    dto: ShareLinkDto,
    actorId: string,
    ipAddress: string | null,
    rotate = false,
  ) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.board.update({
      where: { id: boardId },
      data: { shareToken: token, shareRole: dto.role },
    });
    await this.audit.log(
      rotate ? 'BOARD_SHARE_LINK_ROTATED' : 'BOARD_SHARE_LINK_CREATED',
      { actorId, boardId, ipAddress, metadata: { role: dto.role } },
    );
    return {
      token,
      url: `/board/${boardId}?token=${encodeURIComponent(token)}`,
      role: dto.role,
    };
  }

  async disableShareLink(
    boardId: string,
    actorId: string,
    ipAddress: string | null,
  ): Promise<{ ok: true }> {
    await this.prisma.board.update({
      where: { id: boardId },
      data: { shareToken: null, shareRole: Role.VIEWER },
    });
    await this.audit.log('BOARD_SHARE_LINK_DISABLED', {
      actorId,
      boardId,
      ipAddress,
    });
    return { ok: true };
  }

  async publishRevocation(
    boardId: string,
    userId: string,
    details: { reason: string; newRole?: Role },
  ): Promise<void> {
    await this.redis.pub.publish(
      revokeChannel(boardId, userId),
      JSON.stringify({
        type: 'revoke',
        boardId,
        userId,
        newRole: details.newRole ?? null,
        reason: details.reason,
        at: Date.now(),
      }),
    );
  }
}
