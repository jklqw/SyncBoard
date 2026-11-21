export const API_PREFIX = 'api/v1';
export const WS_BASE_PATH = '/ws/boards';
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_DIMENSION = 8192;

export const WS_TOKEN_BUCKET_CAPACITY = 120;
export const WS_TOKEN_BUCKET_REFILL_PER_SECOND = 120;

export const WS_DEBOUNCE_MS = 3000;
export const WS_CEILING_MS = 15_000;
export const PERSIST_LOCK_TTL_MS = 10_000;

export const WS_RECHECK_INTERVAL_MS = 10_000;
export const WS_SIZE_CHECK_INTERVAL = 100;

/** Hard cap per WebSocket frame; mirrors env MAX_WS_FRAME_BYTES default. */
export const MAX_WS_FRAME_BYTES = 1024 * 1024;
