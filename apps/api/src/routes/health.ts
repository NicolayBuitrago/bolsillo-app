import { Hono } from 'hono';
import type { AppEnv } from '../types';

export interface HealthDeps {
  /** Resolves to `true` when the database answers. */
  checkDb: () => Promise<boolean>;
}

/** `GET /health` — public. 200 when everything is up, 503 when the database is down. */
export function healthRoutes({ checkDb }: HealthDeps) {
  return new Hono<AppEnv>().get('/health', async (c) => {
    const dbOk = await checkDb();
    if (dbOk) {
      return c.json({ status: 'ok', db: 'ok' } as const, 200);
    }
    return c.json({ status: 'degraded', db: 'error' } as const, 503);
  });
}
