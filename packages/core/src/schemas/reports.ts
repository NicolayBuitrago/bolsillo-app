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
