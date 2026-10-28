import { DEFAULT_CATEGORIES } from '@bolsillo/core/categories';
import { newId } from '@bolsillo/core/ids';
import type { Database } from './client';
import { categories, userSettings } from './schema';

/**
 * Creates the user's settings and default categories in one transaction.
 * Idempotent: the settings row acts as the marker, so calling it again (for
 * example on every sign-in) does nothing once the defaults exist.
 *
 * @returns whether the defaults were created by this call.
 */
export async function ensureUserDefaults(db: Database, userId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(userSettings)
      .values({ userId })
      .onConflictDoNothing()
      .returning({ userId: userSettings.userId });
    if (inserted.length === 0) {
      return false;
    }

    const rows: (typeof categories.$inferInsert)[] = [];
    for (const category of DEFAULT_CATEGORIES) {
      const id = newId();
      rows.push({
        id,
        userId,
        name: category.name,
        kind: category.kind,
        icon: category.icon,
        color: category.color,
        isSystem: category.isSystem ?? false,
      });
      for (const child of category.children ?? []) {
        rows.push({
          userId,
          parentId: id,
          name: child.name,
          kind: category.kind,
          icon: child.icon,
          color: category.color,
        });
      }
    }
    await tx.insert(categories).values(rows);
    return true;
  });
}
