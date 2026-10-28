import { createDb, pingDb } from '@bolsillo/db';
import { createTemporaryDatabase, type TemporaryDatabase } from '@bolsillo/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, TEST_WEB_ORIGIN } from './test/helpers';

describe('GET /health', () => {
  let tmp: TemporaryDatabase;

  beforeAll(async () => {
    tmp = await createTemporaryDatabase();
  });

  afterAll(async () => {
    await tmp.destroy();
  });

  it('reports ok when the database answers', async () => {
    const { app } = createTestApp(() => pingDb(tmp.db));
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: 'ok' });
  });

  it('reports 503 when the database is unreachable', async () => {
    const unreachable = createDb('postgres://nobody:wrong@127.0.0.1:1/none', {
      connectionTimeoutMillis: 500,
    });
    try {
      const { app } = createTestApp(() => pingDb(unreachable.db));
      const res = await app.request('/health');
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ status: 'degraded', db: 'error' });
    } finally {
      await unreachable.close();
    }
  });
});

describe('cross-cutting middleware', () => {
  const healthy = async () => true;

  it('adds a request id, reusing a valid incoming one', async () => {
    const { app } = createTestApp(healthy);
    const generated = await app.request('/health');
    expect(generated.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);

    const forwarded = await app.request('/health', { headers: { 'X-Request-Id': 'abc-123' } });
    expect(forwarded.headers.get('x-request-id')).toBe('abc-123');
  });

  it('sets security headers', async () => {
    const { app } = createTestApp(healthy);
    const res = await app.request('/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('allows CORS only for the configured web origin', async () => {
    const { app } = createTestApp(healthy);
    const allowed = await app.request('/health', { headers: { Origin: TEST_WEB_ORIGIN } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe(TEST_WEB_ORIGIN);

    const other = await app.request('/health', { headers: { Origin: 'https://evil.example' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers unknown routes with the standard error shape', async () => {
    const { app } = createTestApp(healthy);
    const res = await app.request('/v1/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' },
    });
  });

  it('logs request metadata without bodies or query strings', async () => {
    const { app, logs } = createTestApp(healthy);
    await app.request('/health?secret=45900', {
      headers: { 'X-Request-Id': 'req-1', Authorization: 'Bearer token-value' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      msg: 'request',
      requestId: 'req-1',
      method: 'GET',
      route: '/health',
      status: 200,
    });
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain('45900');
    expect(serialized).not.toContain('token-value');
  });
});
