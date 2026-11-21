import { z } from 'zod';

export const RoleSchema = z.enum(['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER']);
export type Role = z.infer<typeof RoleSchema>;

export const ROLE_RANK: Record<Role, number> = {
  OWNER: 4,
  EDITOR: 3,
  COMMENTER: 2,
  VIEWER: 1,
};

export function roleAtLeast(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/** Roles allowed to write durable CRDT document updates over the wire. */
export function canWriteDocument(role: Role): boolean {
  return roleAtLeast(role, 'EDITOR');
}

export function canComment(role: Role): boolean {
  return roleAtLeast(role, 'COMMENTER');
}

export const SetRoleSchema = z.object({ role: RoleSchema });
export const InviteSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(2).max(64).optional(),
  role: RoleSchema,
});
export const ShareLinkSchema = z.object({
  role: z.enum(['VIEWER', 'COMMENTER', 'EDITOR']),
});
