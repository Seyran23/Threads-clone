const WINDOW_MS = 60_000;

export const AUTH_CREDENTIAL_THROTTLE = { default: { limit: 5, ttl: WINDOW_MS } };
export const AUTH_REFRESH_THROTTLE = { default: { limit: 20, ttl: WINDOW_MS } };
export const POST_CREATE_THROTTLE = { default: { limit: 20, ttl: WINDOW_MS } };
export const LIKE_THROTTLE = { default: { limit: 60, ttl: WINDOW_MS } };
export const FOLLOW_THROTTLE = { default: { limit: 30, ttl: WINDOW_MS } };
export const MEDIA_UPLOAD_THROTTLE = { default: { limit: 20, ttl: WINDOW_MS } };
export const PROFILE_UPDATE_THROTTLE = { default: { limit: 10, ttl: WINDOW_MS } };
