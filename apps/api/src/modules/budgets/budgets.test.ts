import { newId } from '@bolsillo/core/ids';
import type { Budget, BudgetSummary } from '@bolsillo/core/schemas';
import { transactions } from '@bolsillo/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { categoryId, createAccount, createTransaction, errorCode } from '../../test/fixtures';
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

async function createBudget(body: Record<string, unknown>): Promise<Budget> {
  const res = await user.post('/v1/budgets', body);
  expect(res.status).toBe(201);
  return json<Budget>(res);
}

describe('budgets', () => {
  it('counts subcategories and excludes pending, transfers, other months and currencies', async () => {
    const food = await categoryId(user, 'Alimentación');
    const groceries = await categoryId(user, 'Mercado');
    const restaurants = await categoryId(user, 'Restaurantes');
    const bank = await createAccount(user, { name: 'Banco presupuesto' });
    const savings = await createAccount(user, { name: 'Ahorro presupuesto' });
    const usd = await createAccount(user, { name: 'USD presupuesto', currency: 'USD' });
    const budget = await createBudget({
      categoryId: food,
      amountMinor: 1_000_00,
      startsOn: '2026-10-15',
    });
    expect(budget.startsOn).toBe('2026-10-01');

    const october = '2026-10-10T15:00:00Z';
    await createTransaction(user, bank.id, {
      categoryId: food,
      amountMinor: 100_00,
      occurredAt: october,
    });
    await createTransaction(user, bank.id, {
      categoryId: groceries,
      amountMinor: 200_00,
      occurredAt: october,
    });
    await createTransaction(user, bank.id, {
      categoryId: restaurants,
      amountMinor: 50_00,
      occurredAt: october,
    });
    // Not counted: other month (Nov 1 in Bogotá), other currency, refund income, deleted.
    await createTransaction(user, bank.id, {
      categoryId: groceries,
      amountMinor: 999_00,
      occurredAt: '2026-11-01T05:00:00Z',
    });
    await createTransaction(user, usd.id, {
      categoryId: groceries,
      amountMinor: 999_00,
      occurredAt: october,
    });
    const deleted = await createTransaction(user, bank.id, {
      categoryId: groceries,
      amountMinor: 999_00,
      occurredAt: october,
    });
    await user.delete(`/v1/transactions/${deleted.id}`);
    // Not counted: pending capture and transfers.
    await ctx.db.insert(transactions).values({
      id: newId(),
      userId: user.id,
      accountId: bank.id,
      categoryId: groceries,
      type: 'expense',
      status: 'pending',
      source: 'notification',
      amountMinor: 999_00,
      currency: 'COP',
      occurredAt: new Date(october),
    });
    await user.post('/v1/transfers', {
      id: newId(),
      fromAccountId: bank.id,
      toAccountId: savings.id,
      amountMinor: 999_00,
      occurredAt: october,
    });

    const summary = await json<BudgetSummary>(await user.get('/v1/budgets/summary?month=2026-10'));
    expect(summary.items).toEqual([
      {
        budgetId: budget.id,
        categoryId: food,
        categoryName: 'Alimentación',
        color: '#f97316',
        icon: 'food',
        currency: 'COP',
        amountMinor: 1_000_00,
        spentMinor: 350_00,
        remainingMinor: 650_00,
        percent: 35,
      },
    ]);

    const before = await json<BudgetSummary>(await user.get('/v1/budgets/summary?month=2026-09'));
    expect(before.items).toEqual([]);
  });

  it('reports overspending above 100 %', async () => {
    const other = await signUp(ctx.app);
    const account = await createAccount(other);
    const taxi = await categoryId(other, 'Taxi/apps');
    const res = await other.post('/v1/budgets', {
      categoryId: taxi,
      amountMinor: 100_00,
      startsOn: '2026-10-01',
    });
    expect(res.status).toBe(201);
    await createTransaction(other, account.id, {
      categoryId: taxi,
      amountMinor: 150_00,
      occurredAt: '2026-10-05T15:00:00Z',
    });
    const summary = await json<BudgetSummary>(await other.get('/v1/budgets/summary?month=2026-10'));
    expect(summary.items[0]).toMatchObject({
      spentMinor: 150_00,
      remainingMinor: -50_00,
      percent: 150,
    });
  });

  it('rejects income categories, duplicates and unknown categories', async () => {
    const salary = await categoryId(user, 'Salario', 'income');
    const income = await user.post('/v1/budgets', { categoryId: salary, amountMinor: 100 });
    expect(income.status).toBe(422);

    const transport = await categoryId(user, 'Transporte');
    await createBudget({ categoryId: transport, amountMinor: 100 });
    const duplicate = await user.post('/v1/budgets', { categoryId: transport, amountMinor: 200 });
    expect(duplicate.status).toBe(409);
    expect(await errorCode(duplicate)).toBe('CONFLICT');

    expect((await user.post('/v1/budgets', { categoryId: newId(), amountMinor: 100 })).status).toBe(
      404,
    );
    expect((await user.post('/v1/budgets', { categoryId: transport, amountMinor: 0 })).status).toBe(
      400,
    );
  });

  it('updates, archives and frees the category for a new budget', async () => {
    const health = await categoryId(user, 'Salud');
    const budget = await createBudget({ categoryId: health, amountMinor: 100 });
    const updated = await json<Budget>(
      await user.patch(`/v1/budgets/${budget.id}`, { amountMinor: 300, startsOn: '2026-08-20' }),
    );
    expect(updated).toMatchObject({ amountMinor: 300, startsOn: '2026-08-01' });

    const archived = await json<Budget>(await user.post(`/v1/budgets/${budget.id}/archive`));
    expect(archived.archivedAt).not.toBeNull();
    expect((await user.patch(`/v1/budgets/${budget.id}`, { amountMinor: 1 })).status).toBe(422);
    const active = await json<Budget[]>(await user.get('/v1/budgets'));
    expect(active.map((item) => item.id)).not.toContain(budget.id);
    const all = await json<Budget[]>(await user.get('/v1/budgets?includeArchived=true'));
    expect(all.map((item) => item.id)).toContain(budget.id);
    await createBudget({ categoryId: health, amountMinor: 500 });
  });

  it("hides other users' budgets", async () => {
    const owner = await signUp(ctx.app);
    const pets = await categoryId(owner, 'Mascotas');
    const budget = await json<Budget>(
      await owner.post('/v1/budgets', { categoryId: pets, amountMinor: 100 }),
    );
    const intruder = await signUp(ctx.app);
    expect((await intruder.patch(`/v1/budgets/${budget.id}`, { amountMinor: 1 })).status).toBe(404);
    expect((await intruder.post(`/v1/budgets/${budget.id}/archive`)).status).toBe(404);
    expect((await intruder.post('/v1/budgets', { categoryId: pets, amountMinor: 1 })).status).toBe(
      404,
    );
    expect(await json<Budget[]>(await intruder.get('/v1/budgets'))).toEqual([]);
  });
});
