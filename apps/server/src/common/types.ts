import type { Request } from 'express';
import type { Role } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
}

export interface BoardContext {
  boardId: string;
  role: Role;
}

type RequestWithContext = Request & {
  user?: AuthenticatedUser;
  boardContext?: BoardContext;
};

export function setRequestUser(req: Request, user: AuthenticatedUser): void {
  (req as RequestWithContext).user = user;
}

export function getRequestUser(req: Request): AuthenticatedUser | undefined {
  return (req as RequestWithContext).user;
}

export function requireUser(req: Request): AuthenticatedUser {
  const user = getRequestUser(req);
  if (!user) throw new UnauthorizedException('Authentication required');
  return user;
}

export function setBoardContext(req: Request, context: BoardContext): void {
  (req as RequestWithContext).boardContext = context;
}

export function getBoardContext(req: Request): BoardContext | undefined {
  return (req as RequestWithContext).boardContext;
}

export function clientIp(req: Request): string | null {
  return req.ip ?? req.socket.remoteAddress ?? null;
}

export function userAgent(req: Request): string | null {
  return req.headers['user-agent'] ?? null;
}
