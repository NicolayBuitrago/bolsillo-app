import type { Database } from '@bolsillo/db';
import { alias, and, asc, eq, gte, isNull, lt, lte, or, sql } from '@bolsillo/db/orm';
import { budgets, categories, transactions } from '@bolsillo/db/schema';
import { toSafeInteger } from '../../lib/numbers';
import type { Patch } from '../../lib/patch';

export type BudgetRow = typeof budgets.$inferSelect;
export type BudgetInsert = Omit<typeof budgets.$inferInsert, 'id' | 'userId'>;

export function listBudgets(db: Database, userId: string, includeArchived: boolean) {
  return db
    .select()
    .from(budgets)
    .where(
      and(eq(budgets.userId, userId), includeArchived ? undefined : isNull(budgets.archivedAt)),
    )
    .orderBy(asc(budgets.createdAt));
}

export async function findBudget(db: Database, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.id, id)));
  return row;
}

export async function insertBudget(db: Database, userId: string, values: BudgetInsert) {
  const [row] = await db
    .insert(budgets)
    .values({ ...values, userId })
    .returning();
  return row;
}

export async function updateBudget(
  db: Database,
  userId: string,
  id: string,
  patch: Patch<BudgetInsert>,
) {
  const [row] = await db
    .update(budgets)
    .set(patch)
    .where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
    .returning();
  return row;
}

/**
 * Active budgets that already apply in the month, with the confirmed expenses
 * of their category and its subcategories in the budget currency.
 * Pending, deleted and transfer rows never count.
 */
export async function budgetSpending(
  db: Database,
  userId: string,
  month: { firstDay: string; start: Date; end: Date },
) {
  const budgetCategory = alias(categories, 'budget_category');
  const family = alias(categories, 'family');
  const rows = await db
    .select({
      budget: budgets,
      categoryName: budgetCategory.name,
      color: budgetCategory.color,
      icon: budgetCategory.icon,
      spent: sql<string | null>`sum(${transactions.amountMinor})`,
    })
    .from(budgets)
    .innerJoin(
      budgetCategory,
      and(eq(budgetCategory.userId, budgets.userId), eq(budgetCategory.id, budgets.categoryId)),
    )
    .innerJoin(
      family,
      and(
        eq(family.userId, budgets.userId),
        or(eq(family.id, budgets.categoryId), eq(family.parentId, budgets.categoryId)),
      ),
    )
    .leftJoin(
      transactions,
      and(
        eq(transactions.userId, budgets.userId),
        eq(transactions.categoryId, family.id),
        eq(transactions.currency, budgets.currency),
        eq(transactions.type, 'expense'),
        eq(transactions.status, 'confirmed'),
        isNull(transactions.deletedAt),
        gte(transactions.occurredAt, month.start),
        lt(transactions.occurredAt, month.end),
      ),
    )
    .where(
      and(
        eq(budgets.userId, userId),
        isNull(budgets.archivedAt),
        lte(budgets.startsOn, month.firstDay),
      ),
    )
    .groupBy(budgets.id, budgetCategory.name, budgetCategory.color, budgetCategory.icon);
  return rows.map(({ spent, ...row }) => ({ ...row, spentMinor: toSafeInteger(spent) }));
}
