import { z } from 'zod';
import type { Role } from './permissions.js';

export const BOARD_TEMPLATES = ['blank', 'architecture', 'flowchart', 'mindmap'] as const;
export type BoardTemplate = (typeof BOARD_TEMPLATES)[number];

export const CreateBoardSchema = z.object({
  title: z.string().min(1).max(200).default('Untitled board'),
  template: z.enum(BOARD_TEMPLATES).default('blank'),
  folderName: z.string().max(120).nullable().optional(),
});

export const UpdateBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  folderName: z.string().max(120).nullable().optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const ListBoardsSchema = z.object({
  filter: z.enum(['recent', 'owned', 'shared', 'favorites', 'archived']).default('recent'),
  folder: z.string().max(120).optional(),
  search: z.string().max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export const CreateCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  elementId: z.string().max(128).nullable().optional(),
  parentId: z.string().max(128).nullable().optional(),
});

export const CreateSnapshotSchema = z.object({
  label: z.string().min(1).max(120),
});

export const WsTicketResponseSchema = z.object({
  ticket: z.string(),
  expiresIn: z.number().int(),
});

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

export interface CommentDto {
  id: string;
  boardId: string;
  authorId: string;
  authorName: string;
  x: number | null;
  y: number | null;
  elementId: string | null;
  body: string;
  resolved: boolean;
  parentId: string | null;
  createdAt: string;
}

export interface SnapshotDto {
  id: string;
  boardId: string;
  label: string;
  createdById: string;
  createdAt: string;
}
