import type { Executor } from '@bolsillo/db';
import { and, asc, desc, eq, isNull, lte, sql } from '@bolsillo/db/orm';
import { recurringPayments, transactions, userSettings } from '@bolsillo/db/schema';
import type { Patch } from '../../lib/patch';

export type RecurringRow = typeof recurringPayments.$inferSelect;
export type RecurringInsert = Omit<typeof recurringPayments.$inferInsert, 'id' | 'userId'>;

export function listRecurring(db: Executor, userId: string) {
  return db
    .select()
    .from(recurringPayments)
    .where(eq(recurringPayments.userId, userId))
    .orderBy(desc(recurringPayments.active), asc(recurringPayments.nextDueOn));
}

export async function findRecurring(db: Executor, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(recurringPayments)
    .where(and(eq(recurringPayments.userId, userId), eq(recurringPayments.id, id)));
  return row;
}

/** Same as `findRecurring` but locks the row until the transaction ends. */
export async function lockRecurring(tx: Executor, userId: string, id: string) {
  const [row] = await tx
    .select()
    .from(recurringPayments)
    .where(and(eq(recurringPayments.userId, userId), eq(recurringPayments.id, id)))
    .for('update');
  return row;
}

export async function insertRecurring(db: Executor, userId: string, values: RecurringInsert) {
  const [row] = await db
    .insert(recurringPayments)
    .values({ ...values, userId })
    .returning();
  return row;
}

export async function updateRecurring(
  db: Executor,
  userId: string,
  id: string,
  patch: Patch<RecurringInsert>,
) {
  const [row] = await db
    .update(recurringPayments)
    .set(patch)
    .where(and(eq(recurringPayments.userId, userId), eq(recurringPayments.id, id)))
    .returning();
  return row;
}

/** Oldest active pending transaction created for the payment (by the daily job). */
export async function oldestPendingOccurrence(db: Executor, userId: string, recurringId: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.recurringPaymentId, recurringId),
        eq(transactions.status, 'pending'),
        isNull(transactions.deletedAt),
      ),
    )
    .orderBy(asc(transactions.occurredAt))
    .limit(1);
  return row;
}

/**
 * System query for the daily job (not scoped to one user): active
 * auto-create payments due on or before `maxDueOn`, with each owner's time
 * zone. The job re-checks every row against the owner's local date.
 */
export function listDueAutoCreate(db: Executor, maxDueOn: string) {
  return db
    .select({
      id: recurringPayments.id,
      userId: recurringPayments.userId,
      timezone: sql<string>`coalesce(${userSettings.timezone}, 'America/Bogota')`,
    })
    .from(recurringPayments)
    .leftJoin(userSettings, eq(userSettings.userId, recurringPayments.userId))
    .where(
      and(
        eq(recurringPayments.active, true),
        eq(recurringPayments.autoCreate, true),
        lte(recurringPayments.nextDueOn, maxDueOn),
      ),
    )
    .orderBy(asc(recurringPayments.nextDueOn));
}

/**
 * Inserts the pending transaction of a due date. Returns `undefined` when it
 * already exists (unique `(recurring_payment_id, occurred_at)`), so a repeated
 * run cannot duplicate it.
 */
export async function insertOccurrence(
  db: Executor,
  userId: string,
  values: Omit<typeof transactions.$inferInsert, 'userId'> & { id: string },
) {
  const [row] = await db
    .insert(transactions)
    .values({ ...values, userId })
    .onConflictDoNothing()
    .returning({ id: transactions.id });
  return row;
}
