import type { Settings, UpdateSettingsInput } from '@bolsillo/core/schemas';
import { type Database, ensureUserDefaults } from '@bolsillo/db';
import { findSettings, type SettingsRow, updateSettings } from './repository';

function toSettings(row: SettingsRow): Settings {
  return {
    defaultCurrency: row.defaultCurrency,
    timezone: row.timezone,
    llmExtractionEnabled: row.llmExtractionEnabled,
    captureBodyRetentionDays: row.captureBodyRetentionDays,
  };
}

export function createSettingsService(db: Database) {
  /** Reads the settings, creating the user's defaults first if the sign-up bootstrap failed. */
  async function load(userId: string): Promise<SettingsRow> {
    const existing = await findSettings(db, userId);
    if (existing) return existing;
    await ensureUserDefaults(db, userId);
    const created = await findSettings(db, userId);
    if (!created) throw new Error('User settings missing after bootstrap');
    return created;
  }

  return {
    load,

    async get(userId: string): Promise<Settings> {
      return toSettings(await load(userId));
    },

    async update(userId: string, input: UpdateSettingsInput): Promise<Settings> {
      await load(userId);
      if (Object.keys(input).length === 0) {
        return toSettings(await load(userId));
      }
      const row = await updateSettings(db, userId, input);
      if (!row) throw new Error('User settings missing after bootstrap');
      return toSettings(row);
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
