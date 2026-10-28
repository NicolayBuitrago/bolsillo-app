import { newId } from '@bolsillo/core/ids';
import type { Account, Transaction } from '@bolsillo/core/schemas';
import { transactions } from '@bolsillo/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  balanceOf,
  categoryId,
  createAccount,
  createTransaction,
  errorCode,
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

describe('accounts', () => {
  it('creates accounts with the default currency and lists them with balances', async () => {
    const res = await user.post('/v1/accounts', {
      name: 'Bancolombia Ahorros',
      type: 'savings',
      institution: 'Bancolombia',
      last4: '1234',
      initialBalanceMinor: 250_000_00,
      color: '#f59e0b',
      icon: 'savings',
    });
    expect(res.status).toBe(201);
    const account = await json<Account>(res);
    expect(account).toMatchObject({
      currency: 'COP',
      balanceMinor: 250_000_00,
      creditLimitMinor: null,
      archivedAt: null,
    });

    const list = await json<Account[]>(await user.get('/v1/accounts'));
    expect(list.map((item) => item.id)).toContain(account.id);
  });

  it('computes the balance from confirmed, non-deleted transactions only', async () => {
    const account = await createAccount(user, { initialBalanceMinor: 1_000_00 });
    await createTransaction(user, account.id, { type: 'income', amountMinor: 500_00 });
    await createTransaction(user, account.id, { amountMinor: 200_00 });
    const deleted = await createTransaction(user, account.id, { amountMinor: 50_00 });
    await user.delete(`/v1/transactions/${deleted.id}`);
    await ctx.db.insert(transactions).values({
      id: newId(),
      userId: user.id,
      accountId: account.id,
      type: 'expense',
      status: 'pending',
      source: 'notification',
      amountMinor: 999_00,
      currency: 'COP',
      occurredAt: new Date(),
    });

    expect(await balanceOf(user, account.id)).toBe(1_000_00 + 500_00 - 200_00);
  });

  it('shows credit card spending as debt', async () => {
    const card = await createAccount(user, {
      name: 'Visa',
      type: 'credit_card',
      creditLimitMinor: 3_000_000_00,
    });
    await createTransaction(user, card.id, { amountMinor: 120_000_00 });
    expect(await balanceOf(user, card.id)).toBe(-120_000_00);
  });

  it('keeps active account names unique', async () => {
    await createAccount(user, { name: 'Nequi' });
    const duplicate = await user.post('/v1/accounts', { name: 'Nequi', type: 'digital_wallet' });
    expect(duplicate.status).toBe(409);
    expect(await errorCode(duplicate)).toBe('CONFLICT');
  });

  it('only allows a credit limit on credit cards', async () => {
    const res = await user.post('/v1/accounts', {
      name: 'Efectivo',
      type: 'cash',
      creditLimitMinor: 100,
    });
    expect(res.status).toBe(422);

    const card = await createAccount(user, { type: 'credit_card', creditLimitMinor: 500_00 });
    const changed = await user.patch(`/v1/accounts/${card.id}`, { type: 'bank' });
    expect(await json<Account>(changed)).toMatchObject({ type: 'bank', creditLimitMinor: null });
  });

  it('archives accounts and hides them unless asked', async () => {
    const account = await createAccount(user, { name: 'Vieja' });
    const archived = await json<Account>(await user.post(`/v1/accounts/${account.id}/archive`));
    expect(archived.archivedAt).not.toBeNull();

    const active = await json<Account[]>(await user.get('/v1/accounts'));
    expect(active.map((item) => item.id)).not.toContain(account.id);
    const all = await json<Account[]>(await user.get('/v1/accounts?includeArchived=true'));
    expect(all.map((item) => item.id)).toContain(account.id);

    expect((await user.patch(`/v1/accounts/${account.id}`, { name: 'X' })).status).toBe(422);
    // The name is free again once archived.
    await createAccount(user, { name: 'Vieja' });
  });

  it('validates input', async () => {
    const res = await user.post('/v1/accounts', { name: '', type: 'bank', last4: '12' });
    expect(res.status).toBe(400);
    const body = await json<{ error: { details: { issues: { path: string[] }[] } } }>(res);
    expect(body.error.details.issues.map((issue) => issue.path[0]).sort()).toEqual([
      'last4',
      'name',
    ]);
  });
});

describe('POST /v1/accounts/:id/adjust-balance', () => {
  it('records the difference with the system Ajuste category', async () => {
    const account = await createAccount(user, { initialBalanceMinor: 100_000_00 });

    const up = await user.post(`/v1/accounts/${account.id}/adjust-balance`, {
      actualBalanceMinor: 130_000_00,
    });
    expect(up.status).toBe(200);
    const raised = await json<{ account: Account; transaction: Transaction }>(up);
    expect(raised.account.balanceMinor).toBe(130_000_00);
    expect(raised.transaction).toMatchObject({
      type: 'income',
      amountMinor: 30_000_00,
      status: 'confirmed',
      categoryId: await categoryId(user, 'Ajuste', 'income'),
    });

    const down = await json<{ account: Account; transaction: Transaction }>(
      await user.post(`/v1/accounts/${account.id}/adjust-balance`, {
        actualBalanceMinor: -5_000_00,
      }),
    );
    expect(down.account.balanceMinor).toBe(-5_000_00);
    expect(down.transaction).toMatchObject({
      type: 'expense',
      amountMinor: 135_000_00,
      categoryId: await categoryId(user, 'Ajuste', 'expense'),
    });
  });

  it('does nothing when the balance already matches', async () => {
    const account = await createAccount(user, { initialBalanceMinor: 10_00 });
    const res = await json<{ transaction: Transaction | null }>(
      await user.post(`/v1/accounts/${account.id}/adjust-balance`, { actualBalanceMinor: 10_00 }),
    );
    expect(res.transaction).toBeNull();
  });

  it('rejects adjustments on archived or missing accounts', async () => {
    const account = await createAccount(user);
    await user.post(`/v1/accounts/${account.id}/archive`);
    const again = await user.post(`/v1/accounts/${account.id}/archive`);
    expect(again.status).toBe(200);
    const archived = await user.post(`/v1/accounts/${account.id}/adjust-balance`, {
      actualBalanceMinor: 1,
    });
    expect(archived.status).toBe(422);
    const missing = await user.post(`/v1/accounts/${newId()}/adjust-balance`, {
      actualBalanceMinor: 1,
    });
    expect(missing.status).toBe(404);
  });
});
