import { createTemporaryDatabase, type TemporaryDatabase } from '@bolsillo/db/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMemoryLogger } from '../test/helpers';
import { startJobs } from './index';

let tmp: TemporaryDatabase;

beforeAll(async () => {
  tmp = await createTemporaryDatabase();
});

afterAll(async () => {
  await tmp.destroy();
});

describe('startJobs', () => {
  it('runs a catch-up pass on start and stops cleanly', async () => {
    const { logger, lines } = createMemoryLogger();
    const jobs = startJobs({ db: tmp.db, logger });
    await vi.waitFor(() => {
      expect(lines).toContainEqual(
        expect.objectContaining({ job: 'recurring', msg: 'job finished', skipped: false }),
      );
    });
    await expect(jobs.stop()).resolves.toBeUndefined();
  });

  it('logs a failed run without throwing', async () => {
    const { logger, lines } = createMemoryLogger();
    const broken = { transaction: () => Promise.reject(new TypeError('db down')) };
    const jobs = startJobs({ db: broken as unknown as TemporaryDatabase['db'], logger });
    await vi.waitFor(() => {
      expect(lines).toContainEqual(
        expect.objectContaining({
          job: 'recurring',
          msg: 'job failed',
          err: { name: 'TypeError' },
        }),
      );
    });
    await jobs.stop();
  });
});
