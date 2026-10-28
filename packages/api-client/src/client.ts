import type { AppType } from '@bolsillo/api';
import { type ClientRequestOptions, hc } from 'hono/client';

export type ApiClient = ReturnType<typeof hc<AppType>>;

/**
 * Typed client for the API.
 * - Web: `baseUrl = '/api'` (Next.js rewrites it to the API, same origin).
 * - Mobile: `baseUrl = EXPO_PUBLIC_API_URL`.
 */
export function createApiClient(baseUrl: string, options: ClientRequestOptions = {}): ApiClient {
  return hc<AppType>(baseUrl, { init: { credentials: 'include' }, ...options });
}
