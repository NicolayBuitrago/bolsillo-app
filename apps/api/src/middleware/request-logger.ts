import { createMiddleware } from 'hono/factory';
import { routePath } from 'hono/route';
import type { Logger } from '../logger';
import type { AppEnv } from '../types';

/**
 * Logs one line per request with requestId, method, route pattern, status and
 * duration. Never bodies, query strings or headers.
 */
export function requestLogger(logger: Logger) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const startedAt = performance.now();
    await next();
    logger.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        route: routePath(c, -1),
        status: c.res.status,
        durationMs: Math.round(performance.now() - startedAt),
      },
      'request',
    );
  });
}
