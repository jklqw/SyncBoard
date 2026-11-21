import type { BoardSummary, BoardTemplate, Role, SnapshotDto, CommentDto } from '@syncboard/shared';
import { apiFetch, queryString } from './client';

export interface CreateCommentInput {
  body: string;
  x?: number;
  y?: number;
  elementId?: string | null;
  parentId?: string | null;
}

export type BoardFilter = 'recent' | 'owned' | 'shared' | 'favorites' | 'archived';

export interface ListBoardsParams {
  filter?: BoardFilter;
  search?: string;
  folder?: string;
  limit?: number;
  cursor?: string;
}

export interface BoardListResult {
  items: BoardSummary[];
  nextCursor: string | null;
}

export interface MemberDto {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
  role: Role;
}

export interface ShareLinkDto {
  url: string;
  role: Exclude<Role, 'OWNER'>;
}

export interface UploadResult {
  url: string;
  id: string;
  width: number;
  height: number;
}

export const boardsApi = {
  list(params: ListBoardsParams = {}): Promise<BoardListResult> {
    return apiFetch<BoardListResult>(`/boards${queryString({ ...params })}`);
  },

  get(id: string): Promise<BoardSummary> {
    return apiFetch<BoardSummary>(`/boards/${encodeURIComponent(id)}`);
  },

  create(input: { title: string; template: BoardTemplate; folderName?: string | null }): Promise<BoardSummary> {
    return apiFetch<BoardSummary>('/boards', {
      method: 'POST',
      body: {
        title: input.title,
        template: input.template,
        ...(input.folderName ? { folderName: input.folderName } : {}),
      },
    });
  },

  update(
    id: string,
    patch: { title?: string; folderName?: string | null; isFavorite?: boolean; isArchived?: boolean },
  ): Promise<BoardSummary> {
    return apiFetch<BoardSummary>(`/boards/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
    });
  },

  duplicate(id: string): Promise<BoardSummary> {
    return apiFetch<BoardSummary>(`/boards/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });
  },

  remove(id: string): Promise<void> {
    return apiFetch<void>(`/boards/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  wsTicket(id: string): Promise<{ ticket: string; expiresIn: number }> {
    return apiFetch<{ ticket: string; expiresIn: number }>(`/boards/${encodeURIComponent(id)}/ws-ticket`, {
      method: 'POST',
    });
  },

  comments(id: string): Promise<CommentDto[]> {
    return apiFetch<CommentDto[]>(`/boards/${encodeURIComponent(id)}/comments`);
  },

  createComment(id: string, input: CreateCommentInput): Promise<CommentDto> {
    return apiFetch<CommentDto>(`/boards/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      body: input,
    });
  },

  resolveComment(id: string, commentId: string, resolved: boolean): Promise<CommentDto> {
    return apiFetch<CommentDto>(`/boards/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`, {
      method: 'PATCH',
      body: { resolved },
    });
  },

  snapshots(id: string): Promise<SnapshotDto[]> {
    return apiFetch<SnapshotDto[]>(`/boards/${encodeURIComponent(id)}/snapshots`);
  },

  createSnapshot(id: string, label: string): Promise<SnapshotDto> {
    return apiFetch<SnapshotDto>(`/boards/${encodeURIComponent(id)}/snapshots`, {
      method: 'POST',
      body: { label },
    });
  },

  restoreSnapshot(id: string, snapshotId: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(
      `/boards/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(snapshotId)}/restore`,
      { method: 'POST' },
    );
  },

  members(id: string): Promise<MemberDto[]> {
    return apiFetch<MemberDto[]>(`/boards/${encodeURIComponent(id)}/members`);
  },

  addMember(id: string, input: { email?: string; username?: string; role: Role }): Promise<MemberDto> {
    return apiFetch<MemberDto>(`/boards/${encodeURIComponent(id)}/members`, {
      method: 'POST',
      body: input,
    });
  },

  updateMember(id: string, userId: string, role: Role): Promise<MemberDto> {
    return apiFetch<MemberDto>(`/boards/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: { role },
    });
  },

  removeMember(id: string, userId: string): Promise<void> {
    return apiFetch<void>(`/boards/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  },

  createShareLink(id: string, role: Exclude<Role, 'OWNER'>): Promise<ShareLinkDto> {
    return apiFetch<ShareLinkDto>(`/boards/${encodeURIComponent(id)}/share-link`, {
      method: 'POST',
      body: { role },
    });
  },

  deleteShareLink(id: string): Promise<void> {
    return apiFetch<void>(`/boards/${encodeURIComponent(id)}/share-link`, { method: 'DELETE' });
  },

  upload(id: string, file: File): Promise<UploadResult> {
    const form = new FormData();
    form.append('file', file);
    return apiFetch<UploadResult>(`/boards/${encodeURIComponent(id)}/uploads`, {
      method: 'POST',
      body: form,
    });
  },
};
