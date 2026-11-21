import { WS_BASE_PATH } from '../../common/constants/limits';

export interface ParsedBoardWsUrl {
  boardId: string;
  ticket: string;
}

/** Parse `/ws/boards/:boardId?ticket=...` (pure, unit-testable). */
export function parseBoardWsUrl(url: string | undefined): ParsedBoardWsUrl | null {
  if (!url) return null;
  const prefix = `${WS_BASE_PATH}/`;
  if (!url.startsWith(prefix)) return null;

  const queryIndex = url.indexOf('?');
  const pathPart = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  const queryPart = queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
  const encoded = pathPart.slice(prefix.length);
  if (!encoded || encoded.includes('/')) return null;

  const ticket = new URLSearchParams(queryPart).get('ticket');
  if (!ticket) return null;

  try {
    const boardId = decodeURIComponent(encoded);
    return boardId.length > 0 ? { boardId, ticket } : null;
  } catch {
    return null;
  }
}
