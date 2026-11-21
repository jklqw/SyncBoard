export function roomUpdatesChannel(boardId: string): string {
  return `syncboard:room:${boardId}:updates`;
}

export function roomAwarenessChannel(boardId: string): string {
  return `syncboard:room:${boardId}:awareness`;
}

export function roomCommentsChannel(boardId: string): string {
  return `syncboard:room:${boardId}:comments`;
}

export function revokePattern(boardId: string): string {
  return `syncboard:revoke:${boardId}:*`;
}

export function revokeChannel(boardId: string, userId: string): string {
  return `syncboard:revoke:${boardId}:${userId}`;
}

export function wsTicketKey(ticket: string): string {
  return `syncboard:ws-ticket:${ticket}`;
}

export function persistLockKey(boardId: string): string {
  return `syncboard:persist-lock:${boardId}`;
}

export function revokedFamilyKey(familyId: string): string {
  return `syncboard:revoked-family:${familyId}`;
}
