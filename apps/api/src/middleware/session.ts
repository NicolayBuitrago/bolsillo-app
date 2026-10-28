import { createMiddleware } from 'hono/factory';
import type { Auth } from '../auth';
import { UnauthenticatedError } from '../errors';
import type { AppEnv } from '../types';

/**
 * Resolves the Better Auth session (cookie, also sent by the mobile app in the
 * `Cookie` header) and exposes `userId`. The user id never comes from the body
 * or the URL.
 */
export function requireSession(auth: Auth) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      throw new UnauthenticatedError();
    }
    c.set('userId', session.user.id);
    await next();
  });
}
