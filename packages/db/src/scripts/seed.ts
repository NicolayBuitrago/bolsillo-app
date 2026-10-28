import { createDb } from '../client';
import { loadDbEnv } from '../env';
import { seed } from '../seed';

const { DATABASE_URL } = loadDbEnv();
const password = process.env.SEED_DEMO_PASSWORD;
if (!password || password.length < 8) {
  console.error('SEED_DEMO_PASSWORD is required (at least 8 characters). See .env.example.');
  process.exit(1);
}

const handle = createDb(DATABASE_URL);
try {
  const result = await seed(handle.db, { password });
  process.stdout.write(
    `Seed finished: ${result.email} with ${result.accounts} accounts, ` +
      `${result.transactions} transactions (${result.transfers} transfers), ` +
      `${result.budgets} budgets and ${result.recurringPayments} recurring payments.\n`,
  );
} finally {
  await handle.close();
}
