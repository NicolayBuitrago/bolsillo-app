import type { Database } from '@bolsillo/db';
import { and, asc, eq, isNull, sql } from '@bolsillo/db/orm';
import { financialAccounts, transactions } from '@bolsillo/db/schema';
import { toSafeInteger } from '../../lib/numbers';
import type { Patch } from '../../lib/patch';

export type AccountRow = typeof financialAccounts.$inferSelect;
export type AccountInsert = Omit<typeof financialAccounts.$inferInsert, 'id' | 'userId'>;
export type AccountWithBalance = AccountRow & { balanceMinor: number };

/** Signed effect of confirmed, non-deleted transactions on each account. */
function balanceDeltas(db: Database, userId: string) {
  return db
    .select({
      accountId: transactions.accountId,
      delta:
        sql<string>`sum(case when ${transactions.type} in ('income', 'transfer_in') then ${transactions.amountMinor} else -${transactions.amountMinor} end)`.as(
          'delta',
        ),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, 'confirmed'),
        isNull(transactions.deletedAt),
      ),
    )
    .groupBy(transactions.accountId)
    .as('deltas');
}

async function selectWithBalance(
  db: Database,
  userId: string,
  filter: { id?: string; includeArchived?: boolean },
): Promise<AccountWithBalance[]> {
  const deltas = balanceDeltas(db, userId);
  const rows = await db
    .select({ account: financialAccounts, delta: deltas.delta })
    .from(financialAccounts)
    .leftJoin(deltas, eq(deltas.accountId, financialAccounts.id))
    .where(
      and(
        eq(financialAccounts.userId, userId),
        filter.id ? eq(financialAccounts.id, filter.id) : undefined,
        filter.includeArchived ? undefined : isNull(financialAccounts.archivedAt),
      ),
    )
    .orderBy(asc(financialAccounts.createdAt), asc(financialAccounts.id));
  return rows.map(({ account, delta }) => ({
    ...account,
    balanceMinor: account.initialBalanceMinor + toSafeInteger(delta),
  }));
}

export function listAccounts(db: Database, userId: string, includeArchived: boolean) {
  return selectWithBalance(db, userId, { includeArchived });
}

/** Includes archived accounts; callers decide whether that is allowed. */
export async function findAccount(
  db: Database,
  userId: string,
  id: string,
): Promise<AccountWithBalance | undefined> {
  const [row] = await selectWithBalance(db, userId, { id, includeArchived: true });
  return row;
}

export async function insertAccount(db: Database, userId: string, values: AccountInsert) {
  const [row] = await db
    .insert(financialAccounts)
    .values({ ...values, userId })
    .returning();
  return row;
}

export async function updateAccount(
  db: Database,
  userId: string,
  id: string,
  patch: Patch<AccountInsert>,
) {
  const [row] = await db
    .update(financialAccounts)
    .set(patch)
    .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.id, id)))
    .returning();
  return row;
}
