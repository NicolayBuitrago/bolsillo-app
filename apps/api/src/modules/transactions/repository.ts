import type { TransactionSource, TransactionStatus, TransactionType } from '@bolsillo/core/schemas';
import type { Executor } from '@bolsillo/db';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from '@bolsillo/db/orm';
import { categories, transactions } from '@bolsillo/db/schema';
import type { Patch } from '../../lib/patch';

export type TransactionRow = typeof transactions.$inferSelect;
export type TransactionInsert = Omit<typeof transactions.$inferInsert, 'userId'> & { id: string };
export type TransactionPatch = Patch<
  Pick<
    TransactionRow,
    | 'type'
    | 'accountId'
    | 'categoryId'
    | 'amountMinor'
    | 'currency'
    | 'occurredAt'
    | 'merchant'
    | 'note'
  >
>;

export interface TransactionFilters {
  start?: Date;
  /** Exclusive. */
  end?: Date;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  source?: TransactionSource;
  q?: string;
  /** Rows strictly after this position in `(occurredAt desc, id desc)` order. */
  after?: { occurredAt: Date; id: string };
  limit: number;
}

const active = (userId: string) =>
  and(eq(transactions.userId, userId), isNull(transactions.deletedAt));

/** Escapes LIKE wildcards so the search text is matched literally. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function listTransactions(
  db: Executor,
  userId: string,
  filters: TransactionFilters,
): Promise<TransactionRow[]> {
  const conditions: (SQL | undefined)[] = [active(userId)];
  if (filters.start) conditions.push(gte(transactions.occurredAt, filters.start));
  if (filters.end) conditions.push(lt(transactions.occurredAt, filters.end));
  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.status) conditions.push(eq(transactions.status, filters.status));
  if (filters.source) conditions.push(eq(transactions.source, filters.source));
  if (filters.categoryId) {
    // The category or any of its subcategories.
    const family = db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          or(eq(categories.id, filters.categoryId), eq(categories.parentId, filters.categoryId)),
        ),
      );
    conditions.push(inArray(transactions.categoryId, family));
  }
  if (filters.q) {
    const pattern = likePattern(filters.q);
    conditions.push(or(ilike(transactions.merchant, pattern), ilike(transactions.note, pattern)));
  }
  if (filters.after) {
    conditions.push(
      sql`(${transactions.occurredAt}, ${transactions.id}) < (${filters.after.occurredAt}, ${filters.after.id})`,
    );
  }
  return db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
    .limit(filters.limit);
}

/** Active (not deleted) transaction of the user. */
export async function findTransaction(
  db: Executor,
  userId: string,
  id: string,
): Promise<TransactionRow | undefined> {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(active(userId), eq(transactions.id, id)));
  return row;
}

/** Any transaction of the user with this id, deleted or not (idempotency checks). */
export async function findTransactionIncludingDeleted(
  db: Executor,
  userId: string,
  id: string,
): Promise<TransactionRow | undefined> {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)));
  return row;
}

/** Both rows of a transfer (deleted or not), `transfer_out` first. */
export function findTransferRows(
  db: Executor,
  userId: string,
  groupId: string,
): Promise<TransactionRow[]> {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.transferGroupId, groupId)))
    .orderBy(asc(transactions.type));
}

/**
 * Inserts unless the id already exists (for any user). Returns `undefined` on
 * conflict so the caller can apply the idempotency rules.
 */
export async function insertTransaction(
  db: Executor,
  userId: string,
  values: TransactionInsert,
): Promise<TransactionRow | undefined> {
  const [row] = await db
    .insert(transactions)
    .values({ ...values, userId })
    .onConflictDoNothing({ target: transactions.id })
    .returning();
  return row;
}

/** Inserts both rows of a transfer atomically. */
export function insertTransfer(
  db: Executor,
  userId: string,
  out: TransactionInsert,
  incoming: TransactionInsert,
): Promise<TransactionRow[]> {
  return db.transaction(async (tx) =>
    tx
      .insert(transactions)
      .values([
        { ...out, userId },
        { ...incoming, userId },
      ])
      .returning(),
  );
}

export async function updateTransaction(
  db: Executor,
  userId: string,
  id: string,
  patch: TransactionPatch,
): Promise<TransactionRow | undefined> {
  const [row] = await db
    .update(transactions)
    .set(patch)
    .where(and(active(userId), eq(transactions.id, id)))
    .returning();
  return row;
}

/** Applies the same change to both rows of a transfer. */
export function updateTransferRows(
  db: Executor,
  userId: string,
  groupId: string,
  patch: Pick<TransactionPatch, 'amountMinor' | 'occurredAt' | 'note'>,
): Promise<TransactionRow[]> {
  return db
    .update(transactions)
    .set(patch)
    .where(and(active(userId), eq(transactions.transferGroupId, groupId)))
    .returning();
}

/** Soft-deletes a transaction, or both rows when `groupId` is given. */
export async function softDeleteTransaction(
  db: Executor,
  userId: string,
  target: { id: string } | { groupId: string },
): Promise<number> {
  const rows = await db
    .update(transactions)
    .set({ deletedAt: new Date() })
    .where(
      and(
        active(userId),
        'id' in target
          ? eq(transactions.id, target.id)
          : eq(transactions.transferGroupId, target.groupId),
      ),
    )
    .returning({ id: transactions.id });
  return rows.length;
}

/** Turns a pending transaction into a confirmed one, applying corrections. */
export async function confirmTransaction(
  db: Executor,
  userId: string,
  id: string,
  patch: TransactionPatch,
): Promise<TransactionRow | undefined> {
  const [row] = await db
    .update(transactions)
    .set({ ...patch, status: 'confirmed', confirmedAt: new Date() })
    .where(and(active(userId), eq(transactions.id, id), eq(transactions.status, 'pending')))
    .returning();
  return row;
}
