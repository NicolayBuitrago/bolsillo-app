import { newId } from '@bolsillo/core/ids';
import type { Page, Transaction } from '@bolsillo/core/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  balanceOf,
  categoryId,
  createAccount,
  createTransaction,
  errorCode,
  transactionInput,
} from '../../test/fixtures';
import { createTestContext, json, signUp, type TestUser } from '../../test/helpers';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let user: TestUser;

beforeAll(async () => {
  ctx = await createTestContext();
  user = await signUp(ctx.app);
});

afterAll(async () => {
  await ctx.destroy();
});

async function listIds(path: string): Promise<string[]> {
  const page = await json<Page<Transaction>>(await user.get(path));
  return page.items.map((item) => item.id);
}

describe('POST /v1/transactions', () => {
  it('creates a confirmed manual transaction with the account currency', async () => {
    const account = await createAccount(user, { currency: 'USD' });
    const groceries = await categoryId(user, 'Mercado');
    const input = transactionInput(account.id, {
      categoryId: groceries,
      merchant: ' Éxito Calle 80 ',
      note: '',
    });

    const res = await user.post('/v1/transactions', input);
    expect(res.status).toBe(201);
    expect(await json<Transaction>(res)).toMatchObject({
      id: input.id,
      type: 'expense',
      status: 'confirmed',
      source: 'manual',
      currency: 'USD',
      categoryId: groceries,
      merchant: 'Éxito Calle 80',
      note: null,
      occurredAt: '2026-10-15T17:00:00.000Z',
    });
  });

  it('does not duplicate when the same id is sent again', async () => {
    const account = await createAccount(user);
    const input = transactionInput(account.id, { occurredAt: '2026-10-15T12:00:00-05:00' });

    const first = await user.post('/v1/transactions', input);
    const second = await user.post('/v1/transactions', input);
    const third = await user.post('/v1/transactions', input);

    expect([first.status, second.status, third.status]).toEqual([201, 200, 200]);
    expect(await json(second)).toEqual(await json(first));
    expect(await balanceOf(user, account.id)).toBe(-input.amountMinor);
    expect(await listIds(`/v1/transactions?accountId=${account.id}`)).toEqual([input.id]);
  });

  it('does not duplicate concurrent retries', async () => {
    const account = await createAccount(user);
    const input = transactionInput(account.id);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => user.post('/v1/transactions', input)),
    );
    expect(results.map((res) => res.status).sort()).toEqual([200, 200, 200, 201]);
    expect(await balanceOf(user, account.id)).toBe(-input.amountMinor);
  });

  it('answers 409 for the same id with different data', async () => {
    const account = await createAccount(user);
    const input = transactionInput(account.id);
    await user.post('/v1/transactions', input);
    const res = await user.post('/v1/transactions', { ...input, amountMinor: 1 });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe('CONFLICT');
  });

  it('enforces category kind, active account and valid amounts', async () => {
    const account = await createAccount(user);
    const salary = await categoryId(user, 'Salario', 'income');

    const wrongKind = await user.post(
      '/v1/transactions',
      transactionInput(account.id, { categoryId: salary }),
    );
    expect(wrongKind.status).toBe(422);

    const invalid = await user.post(
      '/v1/transactions',
      transactionInput(account.id, { amountMinor: 45.9 }),
    );
    expect(invalid.status).toBe(400);
    expect(await errorCode(invalid)).toBe('VALIDATION_ERROR');

    await user.post(`/v1/accounts/${account.id}/archive`);
    const archived = await user.post('/v1/transactions', transactionInput(account.id));
    expect(archived.status).toBe(422);
  });
});

describe('GET /v1/transactions', () => {
  let accountId: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const account = await createAccount(user, { name: 'Listado' });
    accountId = account.id;
    const food = await categoryId(user, 'Alimentación');
    const restaurants = await categoryId(user, 'Restaurantes');
    const salary = await categoryId(user, 'Salario', 'income');
    const create = async (key: string, overrides: Parameters<typeof transactionInput>[1]) => {
      ids[key] = (await createTransaction(user, accountId, overrides)).id;
    };
    // 2026-10-31 23:30 in Bogotá is 2026-11-01T04:30Z.
    await create('lateOctober', { occurredAt: '2026-11-01T04:30:00Z', categoryId: food });
    await create('november', {
      occurredAt: '2026-11-02T15:00:00Z',
      merchant: 'Crepes & Waffles',
      categoryId: restaurants,
    });
    await create('salary', {
      type: 'income',
      occurredAt: '2026-11-03T15:00:00Z',
      categoryId: salary,
      note: 'Pago quincena',
    });
    await create('tie1', { occurredAt: '2026-11-04T15:00:00Z', merchant: '100% natural' });
    await create('tie2', { occurredAt: '2026-11-04T15:00:00Z' });
  });

  it('pages newest first with an opaque cursor', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor ? `&cursor=${cursor}` : '';
      const page: Page<Transaction> = await json(
        await user.get(`/v1/transactions?accountId=${accountId}&limit=2${query}`),
      );
      expect(page.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);

    const [tieA, tieB] = [ids.tie1, ids.tie2].sort().reverse();
    expect(seen).toEqual([tieA, tieB, ids.salary, ids.november, ids.lateOctober]);
  });

  it('filters dates in the user time zone', async () => {
    expect(
      await listIds(`/v1/transactions?accountId=${accountId}&from=2026-10-01&to=2026-10-31`),
    ).toEqual([ids.lateOctober]);
    expect(
      await listIds(`/v1/transactions?accountId=${accountId}&from=2026-11-02&to=2026-11-03`),
    ).toEqual([ids.salary, ids.november]);
  });

  it('filters by category including subcategories, type and text', async () => {
    const food = await categoryId(user, 'Alimentación');
    expect(await listIds(`/v1/transactions?accountId=${accountId}&categoryId=${food}`)).toEqual([
      ids.november,
      ids.lateOctober,
    ]);
    expect(await listIds(`/v1/transactions?accountId=${accountId}&type=income`)).toEqual([
      ids.salary,
    ]);
    expect(await listIds(`/v1/transactions?accountId=${accountId}&q=waffles`)).toEqual([
      ids.november,
    ]);
    expect(await listIds(`/v1/transactions?accountId=${accountId}&q=QUINCENA`)).toEqual([
      ids.salary,
    ]);
    // LIKE wildcards are matched literally.
    expect(await listIds(`/v1/transactions?accountId=${accountId}&q=100%25`)).toEqual([ids.tie1]);
  });

  it('rejects malformed cursors and filters', async () => {
    expect((await user.get('/v1/transactions?cursor=nope')).status).toBe(400);
    expect((await user.get('/v1/transactions?from=2026-13-01')).status).toBe(400);
    expect((await user.get('/v1/transactions?limit=500')).status).toBe(400);
  });
});

describe('PATCH and DELETE /v1/transactions/:id', () => {
  it('edits fields and moves between accounts', async () => {
    const cop = await createAccount(user);
    const usd = await createAccount(user, { currency: 'USD' });
    const created = await createTransaction(user, cop.id);

    const res = await user.patch(`/v1/transactions/${created.id}`, {
      accountId: usd.id,
      amountMinor: 1_500,
      merchant: 'Amazon',
    });
    expect(res.status).toBe(200);
    expect(await json<Transaction>(res)).toMatchObject({
      accountId: usd.id,
      currency: 'USD',
      amountMinor: 1_500,
      merchant: 'Amazon',
    });
    expect(await balanceOf(user, cop.id)).toBe(0);
    expect(await balanceOf(user, usd.id)).toBe(-1_500);
  });

  it('checks the category against the new type', async () => {
    const account = await createAccount(user);
    const groceries = await categoryId(user, 'Mercado');
    const refunds = await categoryId(user, 'Reembolsos', 'income');
    const created = await createTransaction(user, account.id, { categoryId: groceries });

    expect((await user.patch(`/v1/transactions/${created.id}`, { type: 'income' })).status).toBe(
      422,
    );
    const ok = await user.patch(`/v1/transactions/${created.id}`, {
      type: 'income',
      categoryId: refunds,
    });
    expect(ok.status).toBe(200);
    expect(await balanceOf(user, account.id)).toBe(created.amountMinor);
  });

  it('soft-deletes and then answers 404', async () => {
    const account = await createAccount(user);
    const created = await createTransaction(user, account.id);
    expect((await user.delete(`/v1/transactions/${created.id}`)).status).toBe(204);
    expect((await user.get(`/v1/transactions/${created.id}`)).status).toBe(404);
    expect((await user.delete(`/v1/transactions/${created.id}`)).status).toBe(404);
    expect(await balanceOf(user, account.id)).toBe(0);
    expect((await user.get(`/v1/transactions/${newId()}`)).status).toBe(404);
  });
});
