import type { Database } from './client';

/**
 * Development seed. Empty in phase 0; phase 1 adds the demo user, accounts and
 * transactions described in docs/03-modelo-de-datos.md.
 */
export async function seed(_db: Database): Promise<{ created: number }> {
  return { created: 0 };
}
