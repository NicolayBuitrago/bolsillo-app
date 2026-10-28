import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { env } from './env';

/**
 * Better Auth client. The Expo plugin keeps the session cookie in SecureStore
 * and sends it on auth requests; API requests add it themselves (see api.ts).
 */
export const authClient = createAuthClient({
  baseURL: env.EXPO_PUBLIC_API_URL,
  plugins: [expoClient({ scheme: 'bolsillo', storagePrefix: 'bolsillo', storage: SecureStore })],
});
