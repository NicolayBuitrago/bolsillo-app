import { DEFAULT_CATEGORIES } from '@bolsillo/core/categories';
import type { CategoryTreeNode, Settings } from '@bolsillo/core/schemas';
import { eq } from '@bolsillo/db/orm';
import { userSettings } from '@bolsillo/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, json, signUp, TEST_PASSWORD, TEST_WEB_ORIGIN } from './test/helpers';

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.destroy();
});

describe('authentication', () => {
  it('rejects /v1 requests without a session', async () => {
    const res = await ctx.app.request('/v1/settings');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Se requiere iniciar sesión' },
    });
  });

  it('creates settings and default categories on sign-up', async () => {
    const user = await signUp(ctx.app);

    const settings = await json<Settings>(await user.get('/v1/settings'));
    expect(settings).toEqual({
      defaultCurrency: 'COP',
      timezone: 'America/Bogota',
      llmExtractionEnabled: false,
      captureBodyRetentionDays: 90,
    });

    const tree = await json<CategoryTreeNode[]>(await user.get('/v1/categories'));
    expect(tree).toHaveLength(DEFAULT_CATEGORIES.length);
    const food = tree.find((node) => node.name === 'Alimentación');
    expect(food?.children.map((child) => child.name)).toEqual([
      'Domicilios',
      'Mercado',
      'Restaurantes',
    ]);
  });

  it('repairs missing defaults on the next sign-in', async () => {
    const user = await signUp(ctx.app);
    await ctx.db.delete(userSettings).where(eq(userSettings.userId, user.id));

    const res = await ctx.app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: TEST_WEB_ORIGIN },
      body: JSON.stringify({ email: user.email, password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(200);
    const rows = await ctx.db.select().from(userSettings).where(eq(userSettings.userId, user.id));
    expect(rows).toHaveLength(1);
  });

  it('rejects a wrong password', async () => {
    const user = await signUp(ctx.app);
    const res = await ctx.app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: TEST_WEB_ORIGIN },
      body: JSON.stringify({ email: user.email, password: 'otra-clave-123' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects requests from untrusted origins', async () => {
    const res = await ctx.app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ email: 'evil@test.local', password: TEST_PASSWORD, name: 'X' }),
    });
    expect(res.status).toBe(403);
  });

  it('ends the session on sign-out', async () => {
    const user = await signUp(ctx.app);
    const out = await ctx.app.request('/api/auth/sign-out', {
      method: 'POST',
      headers: { cookie: user.cookie, origin: TEST_WEB_ORIGIN },
    });
    expect(out.status).toBe(200);
    expect((await user.get('/v1/settings')).status).toBe(401);
  });

  it('logs the user id but never passwords or emails', async () => {
    const user = await signUp(ctx.app);
    await user.get('/v1/settings');
    const line = ctx.logs.findLast((entry) => entry.route === '/v1/settings');
    expect(line).toMatchObject({ userId: user.id, status: 200 });
    const serialized = JSON.stringify(ctx.logs);
    expect(serialized).not.toContain(TEST_PASSWORD);
    expect(serialized).not.toContain(user.email);
  });
});
