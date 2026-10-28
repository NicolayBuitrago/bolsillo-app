import type { Database } from '@bolsillo/db';
import { alias, and, asc, eq, gte, isNull, lt } from '@bolsillo/db/orm';
import { categories, financialAccounts, transactions } from '@bolsillo/db/schema';

/** Non-deleted transactions of the user with account and category names, oldest first. */
export function exportRows(db: Database, userId: string, range: { start?: Date; end?: Date }) {
  const parent = alias(categories, 'parent');
  return db
    .select({
      occurredAt: transactions.occurredAt,
      type: transactions.type,
      status: transactions.status,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      merchant: transactions.merchant,
      note: transactions.note,
      accountName: financialAccounts.name,
      categoryName: categories.name,
      parentName: parent.name,
    })
    .from(transactions)
    .leftJoin(
      financialAccounts,
      and(
        eq(financialAccounts.userId, transactions.userId),
        eq(financialAccounts.id, transactions.accountId),
      ),
    )
    .leftJoin(
      categories,
      and(eq(categories.userId, transactions.userId), eq(categories.id, transactions.categoryId)),
    )
    .leftJoin(
      parent,
      and(eq(parent.userId, transactions.userId), eq(parent.id, categories.parentId)),
    )
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        range.start ? gte(transactions.occurredAt, range.start) : undefined,
        range.end ? lt(transactions.occurredAt, range.end) : undefined,
      ),
    )
    .orderBy(asc(transactions.occurredAt), asc(transactions.id));
}
