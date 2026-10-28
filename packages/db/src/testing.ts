import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createDb, type DbHandle } from './client';
import { runMigrations } from './migrate';

export const DEFAULT_TEST_DATABASE_URL =
  'postgres://bolsillo:bolsillo@localhost:5433/bolsillo_test';

export function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

export interface TemporaryDatabase extends DbHandle {
  url: string;
  /** Closes the pool and drops the database. */
  destroy: () => Promise<void>;
}

/**
 * Creates an empty, uniquely named database next to the test database so suites
 * can run in parallel without sharing state. Requires CREATEDB privileges.
 */
export async function createTemporaryDatabase(
  options: { migrate?: boolean } = {},
): Promise<TemporaryDatabase> {
  const baseUrl = new URL(testDatabaseUrl());
  const name = `bolsillo_tmp_${randomUUID().replaceAll('-', '')}`;

  const admin = new Client({ connectionString: baseUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  const handle = createDb(url.toString(), { max: 4 });
  if (options.migrate ?? true) {
    await runMigrations(handle.db);
  }

  return {
    ...handle,
    url: url.toString(),
    destroy: async () => {
      await handle.close();
      const cleanup = new Client({ connectionString: baseUrl.toString() });
      await cleanup.connect();
      try {
        await cleanup.query(`drop database if exists "${name}" with (force)`);
      } finally {
        await cleanup.end();
      }
    },
  };
}
