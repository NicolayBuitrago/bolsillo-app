import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './env';
import type { Logger } from './logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { type HealthDeps, healthRoutes } from './routes/health';
import type { AppEnv } from './types';

export interface AppDeps extends HealthDeps {
  env: Pick<Env, 'WEB_ORIGIN'>;
  logger: Logger;
}

/** Composes middleware and routes. Dependencies are injected so tests can swap them. */
export function createApp({ env, logger, checkDb }: AppDeps) {
  const app = new Hono<AppEnv>()
    .use(requestId())
    .use(requestLogger(logger))
    .use(secureHeaders())
    .use(
      cors({
        origin: env.WEB_ORIGIN,
        credentials: true,
        exposeHeaders: ['X-Request-Id'],
      }),
    );

  app.onError(errorHandler(logger));
  app.notFound(notFoundHandler);

  return app.route('/', healthRoutes({ checkDb }));
}

/** Route types consumed by `@bolsillo/api-client` (`hc<AppType>`). */
export type AppType = ReturnType<typeof createApp>;
