import type { Database } from '@bolsillo/db';
import { alias, and, eq, gte, inArray, isNull, lt, sql } from '@bolsillo/db/orm';
import { categories, financialAccounts, transactions } from '@bolsillo/db/schema';
import { toSafeInteger } from '../../lib/numbers';

export interface Range {
  start: Date;
  end: Date;
}

/** Confirmed, non-deleted income and expenses in the range (transfers excluded). */
function reportable(userId: string, range: Range) {
  return and(
    eq(transactions.userId, userId),
    eq(transactions.status, 'confirmed'),
    isNull(transactions.deletedAt),
    inArray(transactions.type, ['income', 'expense']),
    gte(transactions.occurredAt, range.start),
    lt(transactions.occurredAt, range.end),
  );
}

const incomeSum = sql<string>`sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'income')`;
const expenseSum = sql<string>`sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'expense')`;

export async function totalsByCurrency(db: Database, userId: string, range: Range) {
  const rows = await db
    .select({ currency: transactions.currency, income: incomeSum, expense: expenseSum })
    .from(transactions)
    .where(reportable(userId, range))
    .groupBy(transactions.currency);
  return rows.map((row) => ({
    currency: row.currency,
    incomeMinor: toSafeInteger(row.income),
    expenseMinor: toSafeInteger(row.expense),
  }));
}

/** Totals rolled up to the top-level category; uncategorized rows have a null id. */
export async function totalsByCategory(db: Database, userId: string, range: Range) {
  const parent = alias(categories, 'parent');
  const topId = sql<string | null>`coalesce(${parent.id}, ${categories.id})`;
  const rows = await db
    .select({
      categoryId: topId,
      name: sql<string | null>`coalesce(${parent.name}, ${categories.name})`,
      color: sql<string | null>`coalesce(${parent.color}, ${categories.color})`,
      icon: sql<string | null>`coalesce(${parent.icon}, ${categories.icon})`,
      kind: transactions.type,
      currency: transactions.currency,
      total: sql<string>`sum(${transactions.amountMinor})`,
    })
    .from(transactions)
    .leftJoin(
      categories,
      and(eq(categories.userId, userId), eq(categories.id, transactions.categoryId)),
    )
    .leftJoin(parent, and(eq(parent.userId, userId), eq(parent.id, categories.parentId)))
    .where(reportable(userId, range))
    .groupBy(
      topId,
      sql`coalesce(${parent.name}, ${categories.name})`,
      sql`coalesce(${parent.color}, ${categories.color})`,
      sql`coalesce(${parent.icon}, ${categories.icon})`,
      transactions.type,
      transactions.currency,
    );
  return rows.map((row) => ({
    categoryId: row.categoryId,
    name: row.name,
    color: row.color,
    icon: row.icon,
    kind: row.kind as 'income' | 'expense',
    currency: row.currency,
    totalMinor: toSafeInteger(row.total),
  }));
}

export async function totalsByAccount(db: Database, userId: string, range: Range) {
  const rows = await db
    .select({
      accountId: financialAccounts.id,
      name: financialAccounts.name,
      currency: transactions.currency,
      income: incomeSum,
      expense: expenseSum,
    })
    .from(transactions)
    .innerJoin(
      financialAccounts,
      and(eq(financialAccounts.userId, userId), eq(financialAccounts.id, transactions.accountId)),
    )
    .where(reportable(userId, range))
    .groupBy(financialAccounts.id, financialAccounts.name, transactions.currency);
  return rows.map((row) => ({
    accountId: row.accountId,
    name: row.name,
    currency: row.currency,
    incomeMinor: toSafeInteger(row.income),
    expenseMinor: toSafeInteger(row.expense),
  }));
}
