import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pingDb } from './client';
import { loadDbEnv } from './env';
import { runMigrations } from './migrate';
import { financialAccounts, transactions, user } from './schema';
import { DEMO_EMAIL, seed } from './seed';
import { createTemporaryDatabase, type TemporaryDatabase } from './testing';

describe('database', () => {
  let tmp: TemporaryDatabase;

  beforeAll(async () => {
    tmp = await createTemporaryDatabase({ migrate: false });
  });

  afterAll(async () => {
    await tmp.destroy();
  });

  it('applies all migrations from scratch and is idempotent', async () => {
    await runMigrations(tmp.db);
    await runMigrations(tmp.db);
    const result = await tmp.db.execute<{ count: string }>(
      sql`select count(*)::text as count from drizzle.__drizzle_migrations`,
    );
    expect(Number(result.rows[0]?.count)).toBeGreaterThanOrEqual(1);
  });

  it('runs the seed and can run it again', async () => {
    const now = new Date('2026-10-28T20:00:00Z');
    const first = await seed(tmp.db, { password: 'demo-password', now });
    expect(first).toMatchObject({ email: DEMO_EMAIL, accounts: 4 });
    expect(first.transactions).toBeGreaterThan(120);
    expect(first.transfers).toBeGreaterThan(10);

    const second = await seed(tmp.db, { password: 'demo-password', now });
    expect(second).toEqual(first);
    const users = await tmp.db.select().from(user).where(eq(user.email, DEMO_EMAIL));
    expect(users).toHaveLength(1);

    const demoId = users[0]?.id ?? '';
    const rows = await tmp.db.select().from(transactions).where(eq(transactions.userId, demoId));
    expect(rows).toHaveLength(second.transactions);
    expect(rows.every((row) => row.occurredAt <= now)).toBe(true);
    const accounts = await tmp.db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.userId, demoId));
    expect(accounts.map((row) => row.type).sort()).toEqual([
      'cash',
      'credit_card',
      'digital_wallet',
      'savings',
    ]);
  });

  it('answers the health probe', async () => {
    await expect(pingDb(tmp.db)).resolves.toBe(true);
  });
});

describe('loadDbEnv', () => {
  it('requires a postgres DATABASE_URL', () => {
    expect(() => loadDbEnv({})).toThrow(/DATABASE_URL/);
    expect(() => loadDbEnv({ DATABASE_URL: 'mysql://x@y/z' })).toThrow(/DATABASE_URL/);
    expect(loadDbEnv({ DATABASE_URL: 'postgres://u:p@localhost:5432/db' })).toEqual({
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    });
  });
});
