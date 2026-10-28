import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client. It talks to `/api/auth/*` on this same origin; Next.js
 * rewrites it to the API, so the session cookie is first-party.
 */
export const authClient = createAuthClient();
