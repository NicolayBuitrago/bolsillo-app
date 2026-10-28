import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pingDb } from './client';
import { loadDbEnv } from './env';
import { runMigrations } from './migrate';
import { seed } from './seed';
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

  it('runs the seed', async () => {
    await expect(seed(tmp.db)).resolves.toEqual({ created: 0 });
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
