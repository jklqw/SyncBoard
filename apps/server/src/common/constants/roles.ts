import { Role } from '@prisma/client';

export { Role };

export const ROLE_RANK: Record<Role, number> = {
  OWNER: 3,
  EDITOR: 2,
  COMMENTER: 1,
  VIEWER: 0,
};

export function roleAtLeast(
  actual: Role | null | undefined,
  required: Role,
): boolean {
  if (!actual) return false;
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/** Roles permitted to mutate durable board elements / Y.Doc state. */
export function canWriteBoard(role: Role | null | undefined): boolean {
  return roleAtLeast(role, Role.EDITOR);
}

/** Roles permitted to pin or resolve comments (commenter included). */
export function canComment(role: Role | null | undefined): boolean {
  return roleAtLeast(role, Role.COMMENTER);
}

export function highestRole(a: Role | null, b: Role | null): Role | null {
  if (!a) return b;
  if (!b) return a;
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}
