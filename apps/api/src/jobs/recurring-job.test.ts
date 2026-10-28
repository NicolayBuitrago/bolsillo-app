import type { RecurringPayment, RecurringPaymentResult, Transaction } from '@bolsillo/core/schemas';
import { and, eq, sql } from '@bolsillo/db/orm';
import { transactions } from '@bolsillo/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { categoryId, createAccount } from '../test/fixtures';
import {
  createMemoryLogger,
  createTestContext,
  json,
  signUp,
  type TestUser,
} from '../test/helpers';
import { RECURRING_JOB_LOCK, runRecurringJob } from './recurring-job';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
const { logger } = createMemoryLogger();

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.destroy();
});

/** 06:00 in Bogotá (UTC−5) on a calendar date. */
const sixAm = (date: string) => new Date(`${date}T11:00:00Z`);

async function createPayment(user: TestUser, body: Record<string, unknown>) {
  const account = await createAccount(user);
  const res = await user.post('/v1/recurring', {
    name: 'Arriendo',
    accountId: account.id,
    categoryId: await categoryId(user, 'Arriendo'),
    amountMinor: 1_800_000_00,
    frequency: 'monthly',
    autoCreate: true,
    ...body,
  });
  expect(res.status).toBe(201);
  return json<RecurringPayment>(res);
}

async function occurrencesOf(paymentId: string) {
  return ctx.db
    .select()
    .from(transactions)
    .where(eq(transactions.recurringPaymentId, paymentId))
    .orderBy(transactions.occurredAt);
}

async function nextDueOn(user: TestUser, id: string) {
  const list = await json<RecurringPayment[]>(await user.get('/v1/recurring'));
  return list.find((item) => item.id === id)?.nextDueOn;
}

describe('recurring payments job', () => {
  it('moves a payment due on the 31st through 30-day months and February', async () => {
    const user = await signUp(ctx.app);
    const payment = await createPayment(user, { firstDueOn: '2026-10-31' });

    const seen: string[] = [];
    for (const day of ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']) {
      // The day before nothing is due.
      await runRecurringJob(ctx.db, logger, new Date(sixAm(day).getTime() - 86_400_000));
      expect(await nextDueOn(user, payment.id)).toBe(day);
      await runRecurringJob(ctx.db, logger, sixAm(day));
      seen.push(day);
    }
    expect(await nextDueOn(user, payment.id)).toBe('2027-03-31');

    const rows = await occurrencesOf(payment.id);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.status === 'pending' && row.source === 'recurring')).toBe(true);
    // Noon in Bogotá on each due date.
    expect(rows.map((row) => row.occurredAt.toISOString())).toEqual(
      seen.map((day) => `${day}T17:00:00.000Z`),
    );
  });

  it('does not create duplicates when it runs twice on the same day', async () => {
    const user = await signUp(ctx.app);
    const payment = await createPayment(user, { firstDueOn: '2026-10-05' });

    const first = await runRecurringJob(ctx.db, logger, sixAm('2026-10-05'));
    const second = await runRecurringJob(ctx.db, logger, sixAm('2026-10-05'));
    expect(first.created).toBeGreaterThanOrEqual(1);
    expect(second.created).toBe(0);
    expect(await occurrencesOf(payment.id)).toHaveLength(1);
  });

  it('does not create duplicates when two runs overlap', async () => {
    const user = await signUp(ctx.app);
    const payment = await createPayment(user, { firstDueOn: '2026-10-06' });

    const results = await Promise.all([
      runRecurringJob(ctx.db, logger, sixAm('2026-10-06')),
      runRecurringJob(ctx.db, logger, sixAm('2026-10-06')),
    ]);
    expect(await occurrencesOf(payment.id)).toHaveLength(1);
    expect(results.some((result) => result.skipped || result.created === 0)).toBe(true);
  });

  it('skips the run while another one holds the lock', async () => {
    const user = await signUp(ctx.app);
    const payment = await createPayment(user, { firstDueOn: '2026-10-07' });
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked: () => void = () => undefined;
    const lockTaken = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const holder = ctx.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${RECURRING_JOB_LOCK})`);
      locked();
      await held;
    });
    await lockTaken;

    const blocked = await runRecurringJob(ctx.db, logger, sixAm('2026-10-07'));
    expect(blocked).toEqual({ skipped: true, created: 0, advanced: 0, failed: 0 });
    release();
    await holder;

    const after = await runRecurringJob(ctx.db, logger, sixAm('2026-10-07'));
    expect(after.skipped).toBe(false);
    expect(await occurrencesOf(payment.id)).toHaveLength(1);
  });

  it('catches up overdue dates and ignores payments without auto-create', async () => {
    const user = await signUp(ctx.app);
    const overdue = await createPayment(user, { firstDueOn: '2026-07-10' });
    const manual = await createPayment(user, { firstDueOn: '2026-07-10', autoCreate: false });
    const paused = await createPayment(user, { firstDueOn: '2026-07-10' });
    await user.patch(`/v1/recurring/${paused.id}`, { active: false });

    await runRecurringJob(ctx.db, logger, sixAm('2026-10-10'));

    expect((await occurrencesOf(overdue.id)).length).toBe(4);
    expect(await nextDueOn(user, overdue.id)).toBe('2026-11-10');
    expect(await occurrencesOf(manual.id)).toHaveLength(0);
    expect(await occurrencesOf(paused.id)).toHaveLength(0);
  });

  it('uses the owner time zone for "today"', async () => {
    const user = await signUp(ctx.app);
    await user.patch('/v1/settings', { timezone: 'Asia/Tokyo' });
    const payment = await createPayment(user, { firstDueOn: '2026-10-21' });
    // 2026-10-20T16:00Z is already Oct 21 in Tokyo (UTC+9) but Oct 20 in UTC.
    await runRecurringJob(ctx.db, logger, new Date('2026-10-20T16:00:00Z'));
    expect(await occurrencesOf(payment.id)).toHaveLength(1);
  });
});

describe('paying a recurring payment', () => {
  it('confirms the pending transaction created by the job instead of duplicating it', async () => {
    const user = await signUp(ctx.app);
    const payment = await createPayment(user, { firstDueOn: '2026-10-15' });
    await runRecurringJob(ctx.db, logger, sixAm('2026-10-15'));
    expect(await nextDueOn(user, payment.id)).toBe('2026-11-15');

    const res = await user.post(`/v1/recurring/${payment.id}/pay`, {});
    expect(res.status).toBe(200);
    const result = await json<RecurringPaymentResult>(res);
    expect(result.transaction).toMatchObject({ status: 'confirmed', amountMinor: 1_800_000_00 });
    expect(result.recurringPayment.nextDueOn).toBe('2026-11-15');

    const rows = await ctx.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.recurringPaymentId, payment.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('confirmed');
  });

  it('creates a confirmed transaction and advances when nothing is pending', async () => {
    const user = await signUp(ctx.app);
    const payment = await createPayment(user, { firstDueOn: '2026-10-31', autoCreate: false });
    const res = await user.post(`/v1/recurring/${payment.id}/pay`, {
      occurredAt: '2026-10-30T15:00:00Z',
    });
    const result = await json<RecurringPaymentResult>(res);
    expect(result.transaction).toMatchObject({
      status: 'confirmed',
      source: 'recurring',
      type: 'expense',
      merchant: 'Arriendo',
      occurredAt: '2026-10-30T15:00:00.000Z',
    });
    expect(result.recurringPayment.nextDueOn).toBe('2026-11-30');
    const tx = await json<Transaction>(await user.get(`/v1/transactions/${result.transaction.id}`));
    expect(tx.status).toBe('confirmed');
  });
});
