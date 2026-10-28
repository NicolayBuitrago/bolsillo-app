import { getMonthRange, type MonthKey } from '@bolsillo/core/dates';
import type { MonthlyReport } from '@bolsillo/core/schemas';
import type { Database } from '@bolsillo/db';
import type { SettingsService } from '../settings/service';
import { totalsByAccount, totalsByCategory, totalsByCurrency } from './repository';

export interface ReportsServiceDeps {
  db: Database;
  settings: SettingsService;
}

export function createReportsService({ db, settings }: ReportsServiceDeps) {
  return {
    /** Income, expenses and net for a month in the user's time zone. */
    async monthly(userId: string, month: MonthKey): Promise<MonthlyReport> {
      const { timezone } = await settings.load(userId);
      const range = getMonthRange(month, timezone);
      const [totals, byCategory, byAccount] = await Promise.all([
        totalsByCurrency(db, userId, range),
        totalsByCategory(db, userId, range),
        totalsByAccount(db, userId, range),
      ]);
      return {
        month,
        timezone,
        totals: totals.map((row) => ({ ...row, netMinor: row.incomeMinor - row.expenseMinor })),
        byCategory: byCategory.sort((a, b) => b.totalMinor - a.totalMinor),
        byAccount: byAccount.sort((a, b) => a.name.localeCompare(b.name, 'es')),
      };
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
