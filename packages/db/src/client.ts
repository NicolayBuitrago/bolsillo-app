import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;

export interface DbHandle {
  db: Database;
  pool: Pool;
  close: () => Promise<void>;
}

/** Creates a pooled connection. TypeScript uses camelCase; the database uses snake_case. */
export function createDb(connectionString: string, options: PoolConfig = {}): DbHandle {
  const pool = new Pool({ connectionString, ...options });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool, close: () => pool.end() };
}

/** Cheap connectivity probe used by `GET /health`. */
export async function pingDb(db: Database): Promise<boolean> {
  try {
    await db.execute('select 1');
    return true;
  } catch {
    return false;
  }
}
