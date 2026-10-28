import type { Database } from '@bolsillo/db';
import { createTemporaryDatabase } from '@bolsillo/db/testing';
import { createApp } from '../app';
import { createAuth } from '../auth';
import { createLogger } from '../logger';

export const TEST_WEB_ORIGIN = 'http://localhost:3100';
export const TEST_PASSWORD = 'clave-de-prueba-123';

const TEST_ENV = {
  NODE_ENV: 'test',
  WEB_ORIGIN: TEST_WEB_ORIGIN,
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'test-only-secret-0123456789abcdef0123456789',
} as const;

/** Logger that keeps every line in memory so tests can inspect what was logged. */
export function createMemoryLogger() {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger(
    { LOG_LEVEL: 'info', NODE_ENV: 'test' },
    { write: (line: string) => lines.push(JSON.parse(line)) },
  );
  return { logger, lines };
}

/** Full app (auth included) over `db`, with logs captured in memory. */
export function buildTestApp(db: Database, options: { checkDb?: () => Promise<boolean> } = {}) {
  const { logger, lines } = createMemoryLogger();
  const auth = createAuth({ db, env: TEST_ENV, logger });
  const app = createApp({ env: TEST_ENV, logger, db, auth, ...options });
  return { app, logs: lines };
}

export type TestApp = ReturnType<typeof buildTestApp>['app'];

/** Fresh migrated database plus an app on top of it. Call `destroy` in `afterAll`. */
export async function createTestContext() {
  const database = await createTemporaryDatabase();
  const { app, logs } = buildTestApp(database.db);
  return { app, logs, db: database.db, destroy: database.destroy };
}

export interface TestUser {
  id: string;
  email: string;
  cookie: string;
  get: (path: string) => Promise<Response>;
  post: (path: string, body?: unknown) => Promise<Response>;
  patch: (path: string, body: unknown) => Promise<Response>;
  delete: (path: string) => Promise<Response>;
}

let userCounter = 0;

/** Signs up through Better Auth and returns helpers that send the session cookie. */
export async function signUp(app: TestApp, email?: string): Promise<TestUser> {
  userCounter += 1;
  const address = email ?? `user${userCounter}-${Date.now()}@test.local`;
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: TEST_WEB_ORIGIN },
    body: JSON.stringify({ email: address, password: TEST_PASSWORD, name: 'Persona de prueba' }),
  });
  if (res.status !== 200) {
    throw new Error(`sign-up failed with ${res.status}: ${await res.text()}`);
  }
  const cookie = res.headers
    .getSetCookie()
    .map((header) => header.split(';')[0])
    .join('; ');
  const body = (await res.json()) as { user: { id: string } };

  const send = async (method: string, path: string, payload?: unknown) =>
    app.request(path, {
      method,
      headers: { cookie, 'content-type': 'application/json' },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });

  return {
    id: body.user.id,
    email: address,
    cookie,
    get: (path) => send('GET', path),
    post: (path, payload) => send('POST', path, payload ?? {}),
    patch: (path, payload) => send('PATCH', path, payload),
    delete: (path) => send('DELETE', path),
  };
}

/** Reads a JSON body with a caller-chosen type (tests only). */
export async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
