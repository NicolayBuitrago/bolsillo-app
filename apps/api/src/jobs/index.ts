import type { Database } from '@bolsillo/db';
import cron from 'node-cron';
import type { Logger } from '../logger';
import { runRecurringJob } from './recurring-job';

export interface JobsDeps {
  db: Database;
  logger: Logger;
}

/**
 * In-process scheduled jobs (docs/02-arquitectura.md). Every job takes a
 * Postgres advisory lock, so several API replicas can schedule it safely.
 */
export function startJobs({ db, logger }: JobsDeps) {
  const recurring = async () => {
    try {
      const result = await runRecurringJob(db, logger);
      logger.info({ job: 'recurring', ...result }, 'job finished');
    } catch (error) {
      logger.error({ job: 'recurring', err: { name: (error as Error).name } }, 'job failed');
    }
  };

  const tasks = [
    cron.schedule('0 6 * * *', recurring, {
      name: 'recurring-payments',
      timezone: 'America/Bogota',
      noOverlap: true,
    }),
  ];
  // Catch up on start: the server may have been down at 06:00.
  void recurring();

  return {
    stop: async () => {
      await Promise.all(tasks.map((task) => task.stop()));
    },
  };
}
