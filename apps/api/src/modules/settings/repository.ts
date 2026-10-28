import type { UpdateSettingsInput } from '@bolsillo/core/schemas';
import type { Database } from '@bolsillo/db';
import { eq } from '@bolsillo/db/orm';
import { userSettings } from '@bolsillo/db/schema';

export type SettingsRow = typeof userSettings.$inferSelect;

export async function findSettings(db: Database, userId: string): Promise<SettingsRow | undefined> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return row;
}

export async function updateSettings(
  db: Database,
  userId: string,
  patch: UpdateSettingsInput,
): Promise<SettingsRow | undefined> {
  const [row] = await db
    .update(userSettings)
    .set(patch)
    .where(eq(userSettings.userId, userId))
    .returning();
  return row;
}
