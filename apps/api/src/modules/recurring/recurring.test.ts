import { toDateKey } from '@bolsillo/core/dates';
import { newId } from '@bolsillo/core/ids';
import { addDays } from '@bolsillo/core/recurring';
import type { RecurringPayment, UpcomingPayment } from '@bolsillo/core/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balanceOf, categoryId, createAccount, errorCode } from '../../test/fixtures';
import { createTestContext, json, signUp, type TestUser } from '../../test/helpers';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let user: TestUser;
const today = toDateKey(new Date(), 'America/Bogota');

beforeAll(async () => {
  ctx = await createTestContext();
  user = await signUp(ctx.app);
});

afterAll(async () => {
  await ctx.destroy();
});

async function create(body: Record<string, unknown>): Promise<RecurringPayment> {
  const res = await user.post('/v1/recurring', {
    name: 'Netflix',
    frequency: 'monthly',
    firstDueOn: today,
    ...body,
  });
  expect(res.status).toBe(201);
  return json<RecurringPayment>(res);
}

describe('recurring payments', () => {
  it('creates payments with the account currency and defaults', async () => {
    const usd = await createAccount(user, { currency: 'USD' });
    const payment = await create({ accountId: usd.id, amountMinor: 1_599 });
    expect(payment).toMatchObject({
      currency: 'USD',
      anchorOn: today,
      nextDueOn: today,
      remindDaysBefore: 2,
      autoCreate: false,
      active: true,
    });
    const noAccount = await create({ amountMinor: null });
    expect(noAccount).toMatchObject({ currency: 'COP', accountId: null, amountMinor: null });
  });

  it('validates amounts, categories and currencies', async () => {
    const variable = await user.post('/v1/recurring', {
      name: 'Energía',
      frequency: 'monthly',
      firstDueOn: today,
      autoCreate: true,
    });
    expect(variable.status).toBe(400);

    const salary = await categoryId(user, 'Salario', 'income');
    expect(
      (
        await user.post('/v1/recurring', {
          name: 'X',
          frequency: 'monthly',
          firstDueOn: today,
          categoryId: salary,
        })
      ).status,
    ).toBe(422);

    const cop = await createAccount(user);
    expect(
      (
        await user.post('/v1/recurring', {
          name: 'X',
          frequency: 'monthly',
          firstDueOn: today,
          accountId: cop.id,
          currency: 'USD',
        })
      ).status,
    ).toBe(422);

    const payment = await create({ amountMinor: null });
    const enable = await user.patch(`/v1/recurring/${payment.id}`, { autoCreate: true });
    expect(enable.status).toBe(422);
    expect(await errorCode(enable)).toBe('BUSINESS_RULE');
  });

  it('lists upcoming due dates with reminder days, including overdue ones', async () => {
    const other = await signUp(ctx.app);
    const weekly = await json<RecurringPayment>(
      await other.post('/v1/recurring', {
        name: 'Clases',
        frequency: 'weekly',
        firstDueOn: addDays(today, -7),
        amountMinor: 50_000_00,
        remindDaysBefore: 1,
      }),
    );
    const paused = await json<RecurringPayment>(
      await other.post('/v1/recurring', {
        name: 'Gimnasio',
        frequency: 'monthly',
        firstDueOn: today,
      }),
    );
    await other.patch(`/v1/recurring/${paused.id}`, { active: false });

    const upcoming = await json<UpcomingPayment[]>(
      await other.get('/v1/recurring/upcoming?days=15'),
    );
    expect(upcoming.map((item) => item.dueOn)).toEqual([
      addDays(today, -7),
      today,
      addDays(today, 7),
      addDays(today, 14),
    ]);
    expect(upcoming[1]).toMatchObject({
      recurringPaymentId: weekly.id,
      name: 'Clases',
      remindOn: addDays(today, -1),
      amountMinor: 50_000_00,
    });
    expect((await other.get('/v1/recurring/upcoming?days=91')).status).toBe(400);
  });

  it('moving the due date restarts the schedule from it', async () => {
    const payment = await create({ firstDueOn: '2026-10-31' });
    const moved = await json<RecurringPayment>(
      await user.patch(`/v1/recurring/${payment.id}`, {
        nextDueOn: '2026-12-15',
        name: 'Netflix Premium',
      }),
    );
    expect(moved).toMatchObject({
      anchorOn: '2026-12-15',
      nextDueOn: '2026-12-15',
      name: 'Netflix Premium',
    });
  });

  it('requires an amount and an account to pay variable payments', async () => {
    const account = await createAccount(user, { initialBalanceMinor: 500_000_00 });
    const energy = await create({ name: 'Energía', amountMinor: null });

    const noAmount = await user.post(`/v1/recurring/${energy.id}/pay`, { accountId: account.id });
    expect(noAmount.status).toBe(422);
    const noAccount = await user.post(`/v1/recurring/${energy.id}/pay`, {
      amountMinor: 118_000_00,
    });
    expect(noAccount.status).toBe(422);

    const paid = await user.post(`/v1/recurring/${energy.id}/pay`, {
      amountMinor: 118_000_00,
      accountId: account.id,
    });
    expect(paid.status).toBe(200);
    expect(await balanceOf(user, account.id)).toBe(500_000_00 - 118_000_00);

    await user.patch(`/v1/recurring/${energy.id}`, { active: false });
    expect(
      (await user.post(`/v1/recurring/${energy.id}/pay`, { amountMinor: 1, accountId: account.id }))
        .status,
    ).toBe(422);
  });

  it("hides other users' recurring payments", async () => {
    const owner = await signUp(ctx.app);
    const payment = await json<RecurringPayment>(
      await owner.post('/v1/recurring', {
        name: 'Privado',
        frequency: 'monthly',
        firstDueOn: today,
        amountMinor: 100,
      }),
    );
    const intruder = await signUp(ctx.app);
    expect((await intruder.patch(`/v1/recurring/${payment.id}`, { name: 'X' })).status).toBe(404);
    expect((await intruder.post(`/v1/recurring/${payment.id}/pay`, {})).status).toBe(404);
    expect(await json<RecurringPayment[]>(await intruder.get('/v1/recurring'))).toEqual([]);
    expect(await json<UpcomingPayment[]>(await intruder.get('/v1/recurring/upcoming'))).toEqual([]);
    const ownerAccount = await createAccount(owner);
    expect(
      (
        await intruder.post('/v1/recurring', {
          name: 'X',
          frequency: 'monthly',
          firstDueOn: today,
          accountId: ownerAccount.id,
        })
      ).status,
    ).toBe(404);
    expect((await intruder.post(`/v1/recurring/${newId()}/pay`, {})).status).toBe(404);
  });
});
