import { createDb } from '../client';
import { loadDbEnv } from '../env';
import { runMigrations } from '../migrate';

const { DATABASE_URL } = loadDbEnv();
const handle = createDb(DATABASE_URL);
try {
  await runMigrations(handle.db);
  process.stdout.write('Migrations applied.\n');
} finally {
  await handle.close();
}
