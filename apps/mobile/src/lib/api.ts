import { createApiClient } from '@bolsillo/api-client';
import { authClient } from './auth-client';
import { env } from './env';

/**
 * Typed API client. React Native has no cookie jar we control, so the session
 * cookie from SecureStore goes in the `Cookie` header and `credentials` is
 * `omit` (Better Auth's Expo guide).
 */
export const apiClient = createApiClient(env.EXPO_PUBLIC_API_URL, {
  headers: async (): Promise<Record<string, string>> => {
    const cookie = await authClient.getCookie();
    return cookie ? { Cookie: cookie } : {};
  },
  init: { credentials: 'omit' },
});
