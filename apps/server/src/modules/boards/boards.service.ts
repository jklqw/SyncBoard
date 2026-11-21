import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, type Board, type BoardComment } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CollabService } from '../collab/collab.service';
import { emptyState, buildTemplateState } from './templates';
import type {
  BoardFilter,
  BoardQueryDto,
  CreateBoardDto,
  CreateCommentDto,
  CreateSnapshotDto,
  UpdateBoardDto,
} from './dto/boards.dto';

export interface BoardSummary {
  id: string;
  title: string;
  ownerId: string;
  folderName: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  stateVersion: number;
  role: Role;
  updatedAt: string;
  createdAt: string;
}

interface Cursor {
  u: string;
  i: string;
}

function encodeCursor(board: Board): string {
  const cursor: Cursor = { u: board.updatedAt.toISOString(), i: board.id };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    return typeof parsed.u === 'string' && typeof parsed.i === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collab: CollabService,
    private readonly audit: AuditService,
  ) {}

  toSummary(board: Board, role: Role): BoardSummary {
    return {
      id: board.id,
      title: board.title,
      ownerId: board.ownerId,
      folderName: board.folderName,
      isFavorite: board.isFavorite,
      isArchived: board.isArchived,
      stateVersion: board.stateVersion,
      role,
      updatedAt: board.updatedAt.toISOString(),
      createdAt: board.createdAt.toISOString(),
    };
  }

  async list(userId: string, query: BoardQueryDto) {
    const limit = query.limit ?? 20;
    const memberships = await this.prisma.boardMember.findMany({
      where: { userId },
      select: { boardId: true, role: true },
    });
    const memberRole = new Map<string, Role>(
      memberships.map((membership) => [membership.boardId, membership.role]),
    );
    const sharedIds = Array.from(memberRole.keys());

    const accessible: Prisma.BoardWhereInput = {
      OR: [{ ownerId: userId }, { id: { in: sharedIds } }],
    };
    const filter: BoardFilter = query.filter ?? 'recent';

    const where: Prisma.BoardWhereInput = { ...accessible };
    if (filter === 'owned') {
      where.AND = [{ ownerId: userId }];
    } else if (filter === 'shared') {
      where.AND = [{ id: { in: sharedIds } }];
    } else if (filter === 'favorites') {
      where.AND = [{ isFavorite: true }];
    } else if (filter === 'archived') {
      where.AND = [{ isArchived: true }];
    } else {
      where.AND = [{ isArchived: false }];
    }

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }
    if (query.folder) {
      where.folderName = query.folder;
    }

    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      const updatedAt = new Date(cursor.u);
      if (!Number.isNaN(updatedAt.getTime())) {
        const existing = where.AND ?? [];
        where.AND = [
          ...existing,
          {
            OR: [
              { updatedAt: { lt: updatedAt } },
              { updatedAt, id: { lt: cursor.i } },
            ],
          },
        ];
      }
    }

    const boards = await this.prisma.board.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = boards.length > limit;
    const page = hasMore ? boards.slice(0, limit) : boards;
    const items = page.map((board) =>
      this.toSummary(
        board,
        board.ownerId === userId
          ? Role.OWNER
          : (memberRole.get(board.id) ?? Role.VIEWER),
      ),
    );

    return {
      items,
      nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1] as Board) : null,
    };
  }

  async create(userId: string, dto: CreateBoardDto): Promise<BoardSummary> {
    const state = buildTemplateState(dto.template ?? 'blank');
    const board = await this.prisma.board.create({
      data: {
        title: dto.title.trim(),
        ownerId: userId,
        folderName: dto.folderName?.trim() || null,
        yjsState: state,
      },
    });
    return this.toSummary(board, Role.OWNER);
  }

  async get(boardId: string, role: Role): Promise<BoardSummary> {
    const board = await this.findBoardOrThrow(boardId);
    return this.toSummary(board, role);
  }

  async findBoardOrThrow(boardId: string): Promise<Board> {
    const board = await this.prisma.board.findUnique({ where: { id: boardId } });
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  async update(
    boardId: string,
    dto: UpdateBoardDto,
    role: Role,
  ): Promise<BoardSummary> {
    const data: Prisma.BoardUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.folderName !== undefined) {
      data.folderName = dto.folderName.trim() || null;
    }
    if (dto.isFavorite !== undefined) data.isFavorite = dto.isFavorite;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;

    const board = await this.prisma.board.update({ where: { id: boardId }, data });
    return this.toSummary(board, role);
  }

  async duplicate(boardId: string, userId: string): Promise<BoardSummary> {
    const board = await this.findBoardOrThrow(boardId);
    const snapshot = await this.prisma.boardSnapshot.findFirst({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
    });
    const state = board.yjsState
      ? Buffer.from(board.yjsState)
      : snapshot
        ? Buffer.from(snapshot.yjsState)
        : emptyState();

    const copy = await this.prisma.board.create({
      data: {
        title: `${board.title} (Copy)`,
        ownerId: userId,
        folderName: board.folderName,
        yjsState: state,
      },
    });
    return this.toSummary(copy, Role.OWNER);
  }

  async remove(
    boardId: string,
    actorId: string,
    ipAddress: string | null,
    hard: boolean,
  ): Promise<{ ok: true }> {
    const board = await this.findBoardOrThrow(boardId);
    if (hard) {
      await this.prisma.board.delete({ where: { id: boardId } });
    } else {
      await this.prisma.board.update({
        where: { id: boardId },
        data: { isArchived: true },
      });
    }
    await this.audit.log('BOARD_DELETED', {
      actorId,
      boardId,
      ipAddress,
      metadata: { hard },
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------- comments

  private toComment(comment: BoardComment & {
    author: {
      id: string;
      email: string;
      username: string;
      displayName: string;
      avatarColor: string;
    };
  }) {
    return {
      id: comment.id,
      boardId: comment.boardId,
      authorId: comment.authorId,
      authorName: comment.author.displayName,
      x: comment.x,
      y: comment.y,
      elementId: comment.elementId,
      body: comment.body,
      resolved: comment.resolved,
      parentId: comment.parentId,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  async listComments(boardId: string) {
    const comments = await this.prisma.boardComment.findMany({
      where: { boardId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
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
    return comments.map((comment) => this.toComment(comment));
  }

  async createComment(
    boardId: string,
    authorId: string,
    dto: CreateCommentDto,
  ) {
    if (dto.parentId) {
      const parent = await this.prisma.boardComment.findFirst({
        where: { id: dto.parentId, boardId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('Parent comment not found');
    }

    const comment = await this.prisma.boardComment.create({
      data: {
        boardId,
        authorId,
        body: dto.body.trim(),
        x: dto.x ?? null,
        y: dto.y ?? null,
        elementId: dto.elementId ?? null,
        parentId: dto.parentId ?? null,
      },
      include: {
        author: {
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
    const result = this.toComment(comment);
    this.collab.broadcastComment(boardId, { type: 'comment:created', comment: result });
    return result;
  }

  async resolveComment(
    boardId: string,
    commentId: string,
    resolved: boolean,
  ) {
    const result = await this.prisma.boardComment.updateMany({
      where: { id: commentId, boardId },
      data: { resolved },
    });
    if (result.count === 0) throw new NotFoundException('Comment not found');
    const comment = await this.prisma.boardComment.findUniqueOrThrow({
      where: { id: commentId },
      include: {
        author: {
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
    const dto = this.toComment(comment);
    this.collab.broadcastComment(boardId, {
      type: 'comment:resolved',
      commentId,
      resolved,
    });
    return dto;
  }

  // --------------------------------------------------------------- snapshots

  async listSnapshots(boardId: string) {
    const snapshots = await this.prisma.boardSnapshot.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        boardId: true,
        label: true,
        createdById: true,
        createdAt: true,
      },
    });
    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      boardId: snapshot.boardId,
      label: snapshot.label,
      createdById: snapshot.createdById,
      createdAt: snapshot.createdAt.toISOString(),
    }));
  }

  async createSnapshot(
    boardId: string,
    createdById: string,
    dto: CreateSnapshotDto,
  ) {
    const board = await this.findBoardOrThrow(boardId);
    const state = board.yjsState ? Buffer.from(board.yjsState) : emptyState();
    const snapshot = await this.prisma.boardSnapshot.create({
      data: {
        boardId,
        createdById,
        label: dto.label.trim(),
        yjsState: state,
      },
      select: {
        id: true,
        boardId: true,
        label: true,
        createdById: true,
        createdAt: true,
      },
    });
    return {
      id: snapshot.id,
      boardId: snapshot.boardId,
      label: snapshot.label,
      createdById: snapshot.createdById,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  async restoreSnapshot(
    boardId: string,
    snapshotId: string,
    actorId: string,
    ipAddress: string | null,
  ) {
    const board = await this.findBoardOrThrow(boardId);
    const snapshot = await this.prisma.boardSnapshot.findFirst({
      where: { id: snapshotId, boardId },
    });
    if (!snapshot) throw new NotFoundException('Snapshot not found');

    const currentState = board.yjsState ? Buffer.from(board.yjsState) : emptyState();
    await this.prisma.boardSnapshot.create({
      data: {
        boardId,
        createdById: actorId,
        label: `Safety checkpoint before restore (${snapshot.label})`,
        yjsState: currentState,
      },
    });

    const state = new Uint8Array(snapshot.yjsState);
    const appliedLive = await this.collab.replaceBoardState(boardId, state);
    if (!appliedLive) {
      await this.prisma.board.update({
        where: { id: boardId },
        data: {
          yjsState: Buffer.from(state),
          stateVersion: { increment: 1 },
        },
      });
    }

    await this.audit.log('BOARD_SNAPSHOT_RESTORED', {
      actorId,
      boardId,
      ipAddress,
      metadata: { snapshotId, label: snapshot.label },
    });
    return { ok: true as const, snapshotId, appliedLive };
  }
}
