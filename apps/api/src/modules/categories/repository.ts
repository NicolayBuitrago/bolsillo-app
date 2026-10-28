import { ADJUSTMENT_CATEGORY_NAME } from '@bolsillo/core/categories';
import type { CategoryKind } from '@bolsillo/core/schemas';
import type { Database } from '@bolsillo/db';
import { and, eq, isNull, or } from '@bolsillo/db/orm';
import { categories } from '@bolsillo/db/schema';
import type { Patch } from '../../lib/patch';

export type CategoryRow = typeof categories.$inferSelect;
export type CategoryInsert = Omit<typeof categories.$inferInsert, 'id' | 'userId'>;

export function listCategories(
  db: Database,
  userId: string,
  includeArchived: boolean,
): Promise<CategoryRow[]> {
  return db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        includeArchived ? undefined : isNull(categories.archivedAt),
      ),
    );
}

/** Includes archived categories; callers decide whether that is allowed. */
export async function findCategory(
  db: Database,
  userId: string,
  id: string,
): Promise<CategoryRow | undefined> {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)));
  return row;
}

/** The system "Ajuste" category used by balance adjustments. */
export async function findAdjustmentCategory(
  db: Database,
  userId: string,
  kind: CategoryKind,
): Promise<CategoryRow | undefined> {
  const [row] = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.isSystem, true),
        eq(categories.kind, kind),
        eq(categories.name, ADJUSTMENT_CATEGORY_NAME),
      ),
    );
  return row;
}

export async function hasActiveChildren(db: Database, userId: string, id: string) {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.parentId, id),
        isNull(categories.archivedAt),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function insertCategory(db: Database, userId: string, values: CategoryInsert) {
  const [row] = await db
    .insert(categories)
    .values({ ...values, userId })
    .returning();
  return row;
}

export async function updateCategory(
  db: Database,
  userId: string,
  id: string,
  patch: Patch<CategoryInsert>,
) {
  const [row] = await db
    .update(categories)
    .set(patch)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .returning();
  return row;
}

/** Archives a category together with its subcategories. */
export async function archiveCategoryTree(db: Database, userId: string, id: string) {
  await db
    .update(categories)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(categories.userId, userId),
        isNull(categories.archivedAt),
        or(eq(categories.id, id), eq(categories.parentId, id)),
      ),
    );
}
