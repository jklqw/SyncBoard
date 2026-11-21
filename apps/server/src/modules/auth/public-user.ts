import type { AuthenticatedUser } from '../../common/types';

export type PublicUser = AuthenticatedUser;

export function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
  };
}
