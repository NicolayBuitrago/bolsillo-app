import { z } from 'zod';
import { monthKeySchema } from '../dates';
import { currencyCodeSchema, positiveAmountMinorSchema } from '../money';
import { dateOnlySchema, idSchema, isoDateTimeSchema } from './common';

export const budgetSchema = z.object({
  id: idSchema,
  categoryId: idSchema,
  amountMinor: positiveAmountMinorSchema,
  currency: currencyCodeSchema,
  /** First day of the first month the budget applies to. */
  startsOn: dateOnlySchema,
  archivedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Budget = z.infer<typeof budgetSchema>;

/**
 * Monthly budget for an expense category (and its subcategories). `startsOn`
 * defaults to the current month and is normalized to the first day of its
 * month; `currency` defaults to the user's default currency.
 */
export const createBudgetSchema = z.object({
  categoryId: idSchema,
  amountMinor: positiveAmountMinorSchema,
  currency: currencyCodeSchema.optional(),
  startsOn: dateOnlySchema.optional(),
});

export type CreateBudgetInput = z.input<typeof createBudgetSchema>;

/** The category and currency of a budget cannot change; archive and create another. */
export const updateBudgetSchema = createBudgetSchema
  .pick({ amountMinor: true, startsOn: true })
  .partial();

export type UpdateBudgetInput = z.input<typeof updateBudgetSchema>;

export const budgetSummaryQuerySchema = z.object({ month: monthKeySchema });

export const budgetSummaryItemSchema = z.object({
  budgetId: idSchema,
  categoryId: idSchema,
  categoryName: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  currency: currencyCodeSchema,
  amountMinor: z.number().int(),
  /** Confirmed expenses of the category and its subcategories in the month. */
  spentMinor: z.number().int(),
  /** Negative when overspent. */
  remainingMinor: z.number().int(),
  /** Rounded percentage spent; can exceed 100. */
  percent: z.number().int(),
});

export type BudgetSummaryItem = z.infer<typeof budgetSummaryItemSchema>;

export const budgetSummarySchema = z.object({
  month: monthKeySchema,
  items: z.array(budgetSummaryItemSchema),
});

export type BudgetSummary = z.infer<typeof budgetSummarySchema>;
