import { newId } from '@bolsillo/core/ids';
import type { MonthlyReport, Settings } from '@bolsillo/core/schemas';
import { eq } from '@bolsillo/db/orm';
import { categories, transactions, userSettings } from '@bolsillo/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { categoryId, createAccount, createTransaction } from '../../test/fixtures';
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

describe('GET /v1/reports/monthly', () => {
  it('summarizes the month in the user time zone', async () => {
    const bank = await createAccount(user, { name: 'Banco' });
    const usd = await createAccount(user, { name: 'Dólares', currency: 'USD' });
    const groceries = await categoryId(user, 'Mercado');
    const restaurants = await categoryId(user, 'Restaurantes');
    const salary = await categoryId(user, 'Salario', 'income');

    await createTransaction(user, bank.id, { amountMinor: 100_00, categoryId: groceries });
    await createTransaction(user, bank.id, { amountMinor: 50_00, categoryId: restaurants });
    await createTransaction(user, bank.id, { amountMinor: 30_00 });
    await createTransaction(user, bank.id, {
      type: 'income',
      amountMinor: 1_000_00,
      categoryId: salary,
    });
    await createTransaction(user, usd.id, { amountMinor: 7_00 });
    // 2026-10-31 23:00 in Bogotá still belongs to October.
    await createTransaction(user, bank.id, {
      amountMinor: 1_00,
      occurredAt: '2026-11-01T04:00:00Z',
    });
    // Outside the month, deleted or pending: excluded.
    await createTransaction(user, bank.id, {
      amountMinor: 9_00,
      occurredAt: '2026-11-01T05:00:00Z',
    });
    const deleted = await createTransaction(user, bank.id, { amountMinor: 9_00 });
    await user.delete(`/v1/transactions/${deleted.id}`);
    await ctx.db.insert(transactions).values({
      id: newId(),
      userId: user.id,
      accountId: bank.id,
      type: 'expense',
      status: 'pending',
      source: 'notification',
      amountMinor: 9_00,
      currency: 'COP',
      occurredAt: new Date('2026-10-20T15:00:00Z'),
    });

    const report = await json<MonthlyReport>(await user.get('/v1/reports/monthly?month=2026-10'));

    expect(report.timezone).toBe('America/Bogota');
    expect(report.totals).toEqual(
      expect.arrayContaining([
        { currency: 'COP', incomeMinor: 1_000_00, expenseMinor: 181_00, netMinor: 819_00 },
        { currency: 'USD', incomeMinor: 0, expenseMinor: 7_00, netMinor: -7_00 },
      ]),
    );
    const food = report.byCategory.find((row) => row.name === 'Alimentación');
    expect(food).toMatchObject({ kind: 'expense', currency: 'COP', totalMinor: 150_00 });
    expect(food?.categoryId).toBe(await categoryId(user, 'Alimentación'));
    const uncategorized = report.byCategory.filter(
      (row) => row.categoryId === null && row.currency === 'COP',
    );
    expect(uncategorized).toEqual([
      expect.objectContaining({ kind: 'expense', totalMinor: 31_00, name: null }),
    ]);
    expect(report.byAccount).toEqual([
      {
        accountId: bank.id,
        name: 'Banco',
        currency: 'COP',
        incomeMinor: 1_000_00,
        expenseMinor: 181_00,
      },
      { accountId: usd.id, name: 'Dólares', currency: 'USD', incomeMinor: 0, expenseMinor: 7_00 },
    ]);
  });

  it('follows the user time zone setting', async () => {
    const other = await signUp(ctx.app);
    const account = await createAccount(other);
    await createTransaction(other, account.id, { occurredAt: '2026-11-01T04:00:00Z' });
    const settings = await json<Settings>(await other.patch('/v1/settings', { timezone: 'UTC' }));
    expect(settings.timezone).toBe('UTC');

    const october = await json<MonthlyReport>(await other.get('/v1/reports/monthly?month=2026-10'));
    const november = await json<MonthlyReport>(
      await other.get('/v1/reports/monthly?month=2026-11'),
    );
    expect(october.totals).toEqual([]);
    expect(november.totals).toHaveLength(1);
  });

  it('validates the month', async () => {
    expect((await user.get('/v1/reports/monthly?month=2026-13')).status).toBe(400);
    expect((await user.get('/v1/reports/monthly')).status).toBe(400);
  });
});

describe('settings', () => {
  it('updates and validates settings', async () => {
    const updated = await json<Settings>(
      await user.patch('/v1/settings', { defaultCurrency: 'USD', captureBodyRetentionDays: 30 }),
    );
    expect(updated).toMatchObject({ defaultCurrency: 'USD', captureBodyRetentionDays: 30 });
    expect((await user.patch('/v1/settings', {})).status).toBe(200);
    expect((await user.patch('/v1/settings', { timezone: 'Mars/Base' })).status).toBe(400);

    const account = await createAccount(user, { name: 'Default USD' });
    expect(account.currency).toBe('USD');
  });

  it('recreates missing settings and categories when they are read', async () => {
    const other = await signUp(ctx.app);
    await ctx.db.delete(categories).where(eq(categories.userId, other.id));
    await ctx.db.delete(userSettings).where(eq(userSettings.userId, other.id));

    const settings = await json<Settings>(await other.get('/v1/settings'));
    expect(settings.defaultCurrency).toBe('COP');
    const account = await createAccount(other, { initialBalanceMinor: 0 });
    const res = await other.post(`/v1/accounts/${account.id}/adjust-balance`, {
      actualBalanceMinor: 10_00,
    });
    expect(res.status).toBe(200);
  });
});
