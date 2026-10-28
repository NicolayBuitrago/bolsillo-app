import { getMonthRange, type MonthKey, shiftMonthKey, toMonthKey } from '@bolsillo/core/dates';
import { type MonthlyReport, TREND_MONTHS, type TrendReport } from '@bolsillo/core/schemas';
import type { Database } from '@bolsillo/db';
import type { SettingsService } from '../settings/service';
import { totalsByAccount, totalsByCategory, totalsByCurrency, totalsByMonth } from './repository';

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

    /** The last `months` months up to the current one; months without data are included. */
    async trend(userId: string, months: number = TREND_MONTHS.default): Promise<TrendReport> {
      const { timezone } = await settings.load(userId);
      const current = toMonthKey(new Date(), timezone);
      const keys = Array.from({ length: months }, (_, index) =>
        shiftMonthKey(current, index - months + 1),
      );
      const first = keys[0] ?? current;
      const range = {
        start: getMonthRange(first, timezone).start,
        end: getMonthRange(current, timezone).end,
      };
      const rows = await totalsByMonth(db, userId, range, timezone);
      return {
        timezone,
        months: keys.map((month) => ({
          month,
          totals: rows
            .filter((row) => row.month === month)
            .map(({ currency, incomeMinor, expenseMinor }) => ({
              currency,
              incomeMinor,
              expenseMinor,
              netMinor: incomeMinor - expenseMinor,
            })),
        })),
      };
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
