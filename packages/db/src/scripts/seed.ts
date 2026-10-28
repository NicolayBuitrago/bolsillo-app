import { createDb } from '../client';
import { loadDbEnv } from '../env';
import { seed } from '../seed';

const { DATABASE_URL } = loadDbEnv();
const handle = createDb(DATABASE_URL);
try {
  const { created } = await seed(handle.db);
  process.stdout.write(`Seed finished (${created} records).\n`);
} finally {
  await handle.close();
}
