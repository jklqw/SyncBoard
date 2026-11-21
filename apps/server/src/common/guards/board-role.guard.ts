import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import type { Request } from 'express';
import { BOARD_ROLE_METADATA } from '../decorators/require-board-role.decorator';
import { PermissionsService } from '../../modules/permissions/permissions.service';
import { roleAtLeast } from '../constants/roles';
import { requireUser, setBoardContext } from '../types';

function extractBoardId(req: Request): string | undefined {
  const params = req.params as Record<string, string | undefined>;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const candidate = params.id ?? params.boardId ?? body.boardId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
}

function extractShareToken(req: Request): string | undefined {
  const query = req.query as Record<string, unknown>;
  const value = query.shareToken ?? query.token;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

@Injectable()
export class BoardRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role | undefined>(
      BOARD_ROLE_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = requireUser(req);
    const boardId = extractBoardId(req);
    if (!boardId) throw new BadRequestException('Board id is required');

    const role = await this.permissions.getRole(
      user.id,
      boardId,
      extractShareToken(req),
    );
    if (!roleAtLeast(role, required)) {
      throw new ForbiddenException('Insufficient board permissions');
    }

    setBoardContext(req, { boardId, role: role as Role });
    return true;
  }
}
