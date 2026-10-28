import { type Database, pingDb } from '@bolsillo/db';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { AUTH_BASE_PATH, type Auth } from './auth';
import type { Env } from './env';
import type { Logger } from './logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { requireSession } from './middleware/session';
import { accountsRoutes } from './modules/accounts/routes';
import { budgetsRoutes } from './modules/budgets/routes';
import { categoriesRoutes } from './modules/categories/routes';
import { exportRoutes } from './modules/export/routes';
import { recurringRoutes } from './modules/recurring/routes';
import { reportsRoutes } from './modules/reports/routes';
import { settingsRoutes } from './modules/settings/routes';
import { transactionsRoutes } from './modules/transactions/routes';
import { transfersRoutes } from './modules/transfers/routes';
import { healthRoutes } from './routes/health';
import { createServices } from './services';
import type { AppEnv } from './types';

export interface AppDeps {
  env: Pick<Env, 'WEB_ORIGIN'>;
  logger: Logger;
  db: Database;
  auth: Auth;
  /** Overrides the database probe of `GET /health` (tests). */
  checkDb?: () => Promise<boolean>;
}

/** Composes middleware and routes. Dependencies are injected so tests can swap them. */
export function createApp({ env, logger, db, auth, checkDb = () => pingDb(db) }: AppDeps) {
  const services = createServices(db);

  const app = new Hono<AppEnv>()
    .use(requestId())
    .use(requestLogger(logger))
    .use(secureHeaders())
    // CORS must run before the Better Auth handler.
    .use(
      cors({
        origin: env.WEB_ORIGIN,
        credentials: true,
        exposeHeaders: ['X-Request-Id'],
      }),
    );

  app.onError(errorHandler(logger));
  app.notFound(notFoundHandler);

  app.on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, (c) => auth.handler(c.req.raw));

  const v1 = new Hono<AppEnv>()
    .use(requireSession(auth))
    .route('/settings', settingsRoutes(services.settings))
    .route('/accounts', accountsRoutes(services.accounts))
    .route('/categories', categoriesRoutes(services.categories))
    .route('/transactions', transactionsRoutes(services.transactions))
    .route('/transfers', transfersRoutes(services.transfers))
    .route('/reports', reportsRoutes(services.reports))
    .route('/budgets', budgetsRoutes(services.budgets))
    .route('/recurring', recurringRoutes(services.recurring))
    .route('/export', exportRoutes(services.exporter));

  return app.route('/', healthRoutes({ checkDb })).route('/v1', v1);
}

/** Route types consumed by `@bolsillo/api-client` (`hc<AppType>`). */
export type AppType = ReturnType<typeof createApp>;
