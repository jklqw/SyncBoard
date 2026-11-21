import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { RequireBoardRole } from '../../common/decorators/require-board-role.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { BoardRoleGuard } from '../../common/guards/board-role.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { clientIp, getBoardContext, requireUser } from '../../common/types';
import { WsTicketService } from '../collab/ws-ticket.service';
import { BoardsService } from './boards.service';
import {
  BoardQueryDto,
  CreateBoardDto,
  CreateCommentDto,
  CreateSnapshotDto,
  ResolveCommentDto,
  UpdateBoardDto,
} from './dto/boards.dto';

@Controller('boards')
@UseGuards(JwtAuthGuard, BoardRoleGuard)
export class BoardsController {
  constructor(
    private readonly boards: BoardsService,
    private readonly tickets: WsTicketService,
  ) {}

  @Get()
  list(@Req() req: Request, @Query() query: BoardQueryDto) {
    const user = requireUser(req);
    return this.boards.list(user.id, query);
  }

  @Get(':id')
  @RequireBoardRole(Role.VIEWER)
  get(@Param('id') boardId: string, @Req() req: Request) {
    const role = getBoardContext(req)?.role ?? Role.VIEWER;
    return this.boards.get(boardId, role);
  }

  @Post()
  @RateLimit({ keyPrefix: 'boards:create', limit: 30, windowMs: 60_000 })
  create(@Req() req: Request, @Body() dto: CreateBoardDto) {
    const user = requireUser(req);
    return this.boards.create(user.id, dto);
  }

  @Patch(':id')
  @RequireBoardRole(Role.EDITOR)
  update(
    @Param('id') boardId: string,
    @Body() dto: UpdateBoardDto,
    @Req() req: Request,
  ) {
    const role = getBoardContext(req)?.role ?? Role.VIEWER;
    return this.boards.update(boardId, dto, role);
  }

  @Post(':id/duplicate')
  @RequireBoardRole(Role.VIEWER)
  duplicate(@Param('id') boardId: string, @Req() req: Request) {
    const user = requireUser(req);
    return this.boards.duplicate(boardId, user.id);
  }

  @Delete(':id')
  @RequireBoardRole(Role.OWNER)
  remove(
    @Param('id') boardId: string,
    @Query('hard') hard: string | undefined,
    @Req() req: Request,
  ) {
    const user = requireUser(req);
    return this.boards.remove(
      boardId,
      user.id,
      clientIp(req),
      hard === 'true' || hard === '1',
    );
  }

  @Post(':id/ws-ticket')
  @RequireBoardRole(Role.VIEWER)
  wsTicket(
    @Param('id') boardId: string,
    @Query('token') token: string | undefined,
    @Query('shareToken') shareToken: string | undefined,
    @Req() req: Request,
  ) {
    const user = requireUser(req);
    return this.tickets.create(user.id, boardId, shareToken ?? token);
  }

  // ---------------------------------------------------------------- comments

  @Get(':id/comments')
  @RequireBoardRole(Role.VIEWER)
  comments(@Param('id') boardId: string) {
    return this.boards.listComments(boardId);
  }

  @Post(':id/comments')
  @RequireBoardRole(Role.COMMENTER)
  createComment(
    @Param('id') boardId: string,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ) {
    const user = requireUser(req);
    return this.boards.createComment(boardId, user.id, dto);
  }

  @Patch(':id/comments/:commentId')
  @RequireBoardRole(Role.COMMENTER)
  resolveComment(
    @Param('id') boardId: string,
    @Param('commentId') commentId: string,
    @Body() dto: ResolveCommentDto,
  ) {
    return this.boards.resolveComment(boardId, commentId, dto.resolved);
  }

  // --------------------------------------------------------------- snapshots

  @Get(':id/snapshots')
  @RequireBoardRole(Role.VIEWER)
  snapshots(@Param('id') boardId: string) {
    return this.boards.listSnapshots(boardId);
  }

  @Post(':id/snapshots')
  @RequireBoardRole(Role.EDITOR)
  createSnapshot(
    @Param('id') boardId: string,
    @Body() dto: CreateSnapshotDto,
    @Req() req: Request,
  ) {
    const user = requireUser(req);
    return this.boards.createSnapshot(boardId, user.id, dto);
  }

  @Post(':id/snapshots/:snapshotId/restore')
  @RequireBoardRole(Role.EDITOR)
  restoreSnapshot(
    @Param('id') boardId: string,
    @Param('snapshotId') snapshotId: string,
    @Req() req: Request,
  ) {
    const user = requireUser(req);
    return this.boards.restoreSnapshot(
      boardId,
      snapshotId,
      user.id,
      clientIp(req),
    );
  }
}
