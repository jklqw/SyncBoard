import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const BOARD_ROLE_METADATA = 'syncboard:required-board-role';

/** Minimum role required to access a route. Read by `BoardRoleGuard`. */
export function RequireBoardRole(role: Role): MethodDecorator & ClassDecorator {
  return SetMetadata(BOARD_ROLE_METADATA, role) as MethodDecorator & ClassDecorator;
}
