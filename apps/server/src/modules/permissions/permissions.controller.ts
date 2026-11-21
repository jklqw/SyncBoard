import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { RequireBoardRole } from '../../common/decorators/require-board-role.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { BoardRoleGuard } from '../../common/guards/board-role.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { clientIp, requireUser } from '../../common/types';
import { PermissionsService } from './permissions.service';
import {
  InviteMemberDto,
  ShareLinkDto,
  UpdateMemberRoleDto,
} from './dto/permissions.dto';

@Controller('boards/:id')
@UseGuards(JwtAuthGuard, BoardRoleGuard)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get('members')
  @RequireBoardRole(Role.VIEWER)
  list(@Param('id') boardId: string) {
    return this.permissions.listMembers(boardId);
  }

  @Post('members')
  @RequireBoardRole(Role.OWNER)
  @RateLimit({ keyPrefix: 'boards:invite', limit: 20, windowMs: 60_000 })
  invite(
    @Param('id') boardId: string,
    @Body() dto: InviteMemberDto,
    @Req() req: Request,
  ) {
    const user = requireUser(req);
    return this.permissions.invite(boardId, dto, user.id, clientIp(req));
  }

  @Patch('members/:userId')
  @RequireBoardRole(Role.OWNER)
  changeRole(
    @Param('id') boardId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: Request,
  ) {
    const user = requireUser(req);
    return this.permissions.changeRole(boardId, userId, dto, user.id, clientIp(req));
  }

  @Delete('members/:userId')
  @RequireBoardRole(Role.OWNER)
  remove(
    @Param('id') boardId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    const user = requireUser(req);
    return this.permissions.removeMember(boardId, userId, user.id, clientIp(req));
  }

  @Post('share-link')
  @RequireBoardRole(Role.OWNER)
  @RateLimit({ keyPrefix: 'boards:share-link', limit: 20, windowMs: 60_000 })
  createShareLink(
    @Param('id') boardId: string,
    @Body() dto: ShareLinkDto,
    @Req() req: Request,
  ) {
    const user = requireUser(req);
    return this.permissions.createShareLink(
      boardId,
      dto,
      user.id,
      clientIp(req),
    );
  }

  @Post('share-link/rotate')
  @RequireBoardRole(Role.OWNER)
  @RateLimit({ keyPrefix: 'boards:share-link', limit: 20, windowMs: 60_000 })
  rotateShareLink(
    @Param('id') boardId: string,
    @Body() dto: ShareLinkDto,
    @Req() req: Request,
  ) {
    const user = requireUser(req);
    return this.permissions.createShareLink(
      boardId,
      dto,
      user.id,
      clientIp(req),
      true,
    );
  }

  @Delete('share-link')
  @RequireBoardRole(Role.OWNER)
  disableShareLink(@Param('id') boardId: string, @Req() req: Request) {
    const user = requireUser(req);
    return this.permissions.disableShareLink(boardId, user.id, clientIp(req));
  }
}
