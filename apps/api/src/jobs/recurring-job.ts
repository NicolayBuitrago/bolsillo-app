import { toDateKey } from '@bolsillo/core/dates';
import { newId } from '@bolsillo/core/ids';
import { nextDueAfter } from '@bolsillo/core/recurring';
import type { Database } from '@bolsillo/db';
import { sql } from '@bolsillo/db/orm';
import type { Logger } from '../logger';
import {
  insertOccurrence,
  listDueAutoCreate,
  lockRecurring,
  updateRecurring,
} from '../modules/recurring/repository';
import { dueInstant } from '../modules/recurring/service';

/** Key of the Postgres advisory lock that keeps one job run at a time. */
export const RECURRING_JOB_LOCK = 20_261_028_001;

/** Overdue dates created per payment and run (e.g. after the server was down). */
const MAX_OCCURRENCES_PER_RUN = 12;

/** Latest local date anywhere (UTC+14): due rows are re-checked per user zone. */
const MAX_OFFSET_MS = 14 * 3_600_000;

export interface RecurringJobResult {
  /** Another run held the lock. */
  skipped: boolean;
  /** Pending transactions created. */
  created: number;
  /** Payments whose next due date advanced. */
  advanced: number;
  failed: number;
}

/**
 * Creates the pending transactions of auto-create recurring payments that are
 * due today (or overdue) in each owner's time zone and advances `nextDueOn`.
 *
 * Safe to run twice: it holds `pg_try_advisory_xact_lock` for the whole run,
 * locks each payment row, advances its due date in the same transaction and
 * the unique `(recurring_payment_id, occurred_at)` index rejects duplicates.
 */
export async function runRecurringJob(
  db: Database,
  logger: Logger,
  now: Date = new Date(),
): Promise<RecurringJobResult> {
  return db.transaction(async (tx) => {
    const lock = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${RECURRING_JOB_LOCK}) as locked`,
    );
    if (!lock.rows[0]?.locked) {
      return { skipped: true, created: 0, advanced: 0, failed: 0 };
    }

    const result: RecurringJobResult = { skipped: false, created: 0, advanced: 0, failed: 0 };
    const maxDueOn = toDateKey(new Date(now.getTime() + MAX_OFFSET_MS), 'UTC');
    for (const candidate of await listDueAutoCreate(tx, maxDueOn)) {
      const today = toDateKey(now, candidate.timezone);
      try {
        // Savepoint: one broken payment does not undo the others.
        await tx.transaction(async (savepoint) => {
          const payment = await lockRecurring(savepoint, candidate.userId, candidate.id);
          if (!payment?.active || !payment.autoCreate || payment.amountMinor === null) return;

          let next = payment.nextDueOn;
          for (let count = 0; next <= today && count < MAX_OCCURRENCES_PER_RUN; count += 1) {
            const inserted = await insertOccurrence(savepoint, payment.userId, {
              id: newId(),
              accountId: payment.accountId,
              categoryId: payment.categoryId,
              type: 'expense',
              status: 'pending',
              source: 'recurring',
              amountMinor: payment.amountMinor,
              currency: payment.currency,
              occurredAt: dueInstant(next, candidate.timezone),
              merchant: payment.name,
              recurringPaymentId: payment.id,
            });
            if (inserted) result.created += 1;
            next = nextDueAfter(payment.anchorOn, payment.frequency, next);
          }
          if (next !== payment.nextDueOn) {
            await updateRecurring(savepoint, payment.userId, payment.id, { nextDueOn: next });
            result.advanced += 1;
          }
        });
      } catch (error) {
        result.failed += 1;
        logger.error(
          {
            job: 'recurring',
            recurringPaymentId: candidate.id,
            err: { name: (error as Error).name },
          },
          'recurring payment failed',
        );
      }
    }
    return result;
  });
}
