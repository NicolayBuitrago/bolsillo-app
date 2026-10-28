import { newId } from '@bolsillo/core/ids';
import type { MonthlyReport, Page, Transaction, Transfer } from '@bolsillo/core/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balanceOf, createAccount, createTransaction, errorCode } from '../../test/fixtures';
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

function transferInput(fromAccountId: string, toAccountId: string, overrides = {}) {
  return {
    id: newId(),
    fromAccountId,
    toAccountId,
    amountMinor: 200_000_00,
    occurredAt: '2026-10-10T15:00:00Z',
    note: 'Ahorro del mes',
    ...overrides,
  };
}

describe('POST /v1/transfers', () => {
  it('creates two linked rows, keeps balances right and stays out of reports', async () => {
    const bank = await createAccount(user, { name: 'Banco', initialBalanceMinor: 1_000_000_00 });
    const savings = await createAccount(user, { name: 'Ahorros' });
    await createTransaction(user, bank.id, { amountMinor: 50_000_00 });
    const input = transferInput(bank.id, savings.id);

    const res = await user.post('/v1/transfers', input);
    expect(res.status).toBe(201);
    const transfer = await json<Transfer>(res);
    expect(transfer.id).toBe(input.id);
    expect(transfer.out).toMatchObject({
      type: 'transfer_out',
      accountId: bank.id,
      amountMinor: 200_000_00,
      transferGroupId: input.id,
      categoryId: null,
      status: 'confirmed',
    });
    expect(transfer.in).toMatchObject({
      type: 'transfer_in',
      accountId: savings.id,
      amountMinor: 200_000_00,
      transferGroupId: input.id,
    });

    expect(await balanceOf(user, bank.id)).toBe(1_000_000_00 - 50_000_00 - 200_000_00);
    expect(await balanceOf(user, savings.id)).toBe(200_000_00);

    const report = await json<MonthlyReport>(await user.get('/v1/reports/monthly?month=2026-10'));
    expect(report.totals).toEqual([
      { currency: 'COP', incomeMinor: 0, expenseMinor: 50_000_00, netMinor: -50_000_00 },
    ]);
    expect(report.byAccount.map((row) => row.accountId)).toEqual([bank.id]);
  });

  it('deletes both rows when either one is deleted and restores balances', async () => {
    const a = await createAccount(user, { initialBalanceMinor: 300_00 });
    const b = await createAccount(user);
    const transfer = await json<Transfer>(
      await user.post('/v1/transfers', transferInput(a.id, b.id, { amountMinor: 100_00 })),
    );

    expect((await user.delete(`/v1/transactions/${transfer.in.id}`)).status).toBe(204);

    expect((await user.get(`/v1/transactions/${transfer.out.id}`)).status).toBe(404);
    expect((await user.get(`/v1/transactions/${transfer.in.id}`)).status).toBe(404);
    expect(await balanceOf(user, a.id)).toBe(300_00);
    expect(await balanceOf(user, b.id)).toBe(0);
    const page = await json<Page<Transaction>>(
      await user.get(`/v1/transactions?accountId=${a.id}`),
    );
    expect(page.items).toEqual([]);
  });

  it('is idempotent by id and rejects the same id with other data', async () => {
    const a = await createAccount(user);
    const b = await createAccount(user);
    const input = transferInput(a.id, b.id);
    const first = await json<Transfer>(await user.post('/v1/transfers', input));

    const retry = await user.post('/v1/transfers', input);
    expect(retry.status).toBe(200);
    expect(await json<Transfer>(retry)).toEqual(first);

    const changed = await user.post('/v1/transfers', { ...input, amountMinor: 1 });
    expect(changed.status).toBe(409);
    expect(await balanceOf(user, b.id)).toBe(200_000_00);
  });

  it('handles concurrent retries without duplicating', async () => {
    const a = await createAccount(user);
    const b = await createAccount(user);
    const input = transferInput(a.id, b.id);
    const results = await Promise.all([
      user.post('/v1/transfers', input),
      user.post('/v1/transfers', input),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 201]);
    expect(await balanceOf(user, b.id)).toBe(200_000_00);
  });

  it('applies amount, date and note edits to both rows only', async () => {
    const a = await createAccount(user);
    const b = await createAccount(user);
    const transfer = await json<Transfer>(
      await user.post('/v1/transfers', transferInput(a.id, b.id)),
    );

    const res = await user.patch(`/v1/transactions/${transfer.out.id}`, {
      amountMinor: 150_000_00,
      note: 'Corregido',
    });
    expect(res.status).toBe(200);
    const incoming = await json<Transaction>(await user.get(`/v1/transactions/${transfer.in.id}`));
    expect(incoming).toMatchObject({ amountMinor: 150_000_00, note: 'Corregido' });
    expect(await balanceOf(user, a.id)).toBe(-150_000_00);

    const blocked = await user.patch(`/v1/transactions/${transfer.out.id}`, { accountId: b.id });
    expect(blocked.status).toBe(422);
    expect(await errorCode(blocked)).toBe('BUSINESS_RULE');
  });

  it('rejects invalid transfers', async () => {
    const cop = await createAccount(user);
    const usd = await createAccount(user, { currency: 'USD' });
    const archived = await createAccount(user);
    await user.post(`/v1/accounts/${archived.id}/archive`);

    const sameAccount = await user.post('/v1/transfers', transferInput(cop.id, cop.id));
    expect(sameAccount.status).toBe(400);

    const currencies = await user.post('/v1/transfers', transferInput(cop.id, usd.id));
    expect(currencies.status).toBe(422);

    const archivedTarget = await user.post('/v1/transfers', transferInput(cop.id, archived.id));
    expect(archivedTarget.status).toBe(422);

    const missing = await user.post('/v1/transfers', transferInput(cop.id, newId()));
    expect(missing.status).toBe(404);
  });
});
