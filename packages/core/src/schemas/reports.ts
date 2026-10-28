import { z } from 'zod';
import { monthKeySchema } from '../dates';
import { amountMinorSchema, currencyCodeSchema } from '../money';
import { categoryKindSchema } from './categories';

export const monthlyReportQuerySchema = z.object({ month: monthKeySchema });

/**
 * Month summary. Only confirmed, non-deleted transactions; transfers are
 * excluded from income/expense. Amounts are never mixed across currencies.
 */
export const monthlyReportSchema = z.object({
  month: monthKeySchema,
  timezone: z.string(),
  totals: z.array(
    z.object({
      currency: currencyCodeSchema,
      incomeMinor: amountMinorSchema,
      expenseMinor: amountMinorSchema,
      netMinor: amountMinorSchema,
    }),
  ),
  /** Rolled up to top-level categories; `categoryId` null = uncategorized. */
  byCategory: z.array(
    z.object({
      categoryId: z.uuid().nullable(),
      name: z.string().nullable(),
      color: z.string().nullable(),
      icon: z.string().nullable(),
      kind: categoryKindSchema,
      currency: currencyCodeSchema,
      totalMinor: amountMinorSchema,
    }),
  ),
  byAccount: z.array(
    z.object({
      accountId: z.uuid(),
      name: z.string(),
      currency: currencyCodeSchema,
      incomeMinor: amountMinorSchema,
      expenseMinor: amountMinorSchema,
    }),
  ),
});

export type MonthlyReport = z.infer<typeof monthlyReportSchema>;

export const TREND_MONTHS = { max: 24, default: 6 } as const;

export const trendQuerySchema = z.object({
  months: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(TREND_MONTHS.max))
    .optional(),
});

/** Income and expenses per month (oldest first, current month last; empty months included). */
export const trendReportSchema = z.object({
  timezone: z.string(),
  months: z.array(
    z.object({
      month: monthKeySchema,
      totals: z.array(
        z.object({
          currency: currencyCodeSchema,
          incomeMinor: amountMinorSchema,
          expenseMinor: amountMinorSchema,
          netMinor: amountMinorSchema,
        }),
      ),
    }),
  ),
});

export type TrendReport = z.infer<typeof trendReportSchema>;

/** `GET /v1/export/transactions.csv`: optional inclusive dates in the user's time zone. */
export const exportQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
