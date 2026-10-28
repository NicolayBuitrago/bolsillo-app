import { z } from 'zod';
import { currencyCodeSchema, positiveAmountMinorSchema } from '../money';
import { recurrenceFrequencySchema } from '../recurring/schedule';
import { dateOnlySchema, idSchema, isoDateTimeSchema, requiredText } from './common';
import { transactionSchema } from './transactions';

export const REMIND_DAYS = { min: 0, max: 30, default: 2 } as const;

export const recurringPaymentSchema = z.object({
  id: idSchema,
  name: z.string(),
  accountId: idSchema.nullable(),
  categoryId: idSchema.nullable(),
  /** `null` = variable amount, asked when paying. */
  amountMinor: positiveAmountMinorSchema.nullable(),
  currency: currencyCodeSchema,
  frequency: recurrenceFrequencySchema,
  /** First due date; later ones keep its day of month (clamped to short months). */
  anchorOn: dateOnlySchema,
  nextDueOn: dateOnlySchema,
  remindDaysBefore: z.number().int(),
  autoCreate: z.boolean(),
  active: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type RecurringPayment = z.infer<typeof recurringPaymentSchema>;

const remindDaysSchema = z.number().int().min(REMIND_DAYS.min).max(REMIND_DAYS.max);

const AUTO_CREATE_NEEDS_AMOUNT = {
  message: 'Para crear el movimiento automáticamente se necesita un monto fijo',
  path: ['autoCreate'],
};

/**
 * `firstDueOn` becomes both the anchor and the next due date. `autoCreate`
 * needs a fixed amount: a pending transaction cannot be created without one.
 */
export const createRecurringPaymentSchema = z
  .object({
    name: requiredText(60),
    accountId: idSchema.nullable().optional(),
    categoryId: idSchema.nullable().optional(),
    amountMinor: positiveAmountMinorSchema.nullable().optional(),
    currency: currencyCodeSchema.optional(),
    frequency: recurrenceFrequencySchema,
    firstDueOn: dateOnlySchema,
    remindDaysBefore: remindDaysSchema.optional(),
    autoCreate: z.boolean().optional(),
  })
  .refine((value) => !value.autoCreate || value.amountMinor != null, AUTO_CREATE_NEEDS_AMOUNT);

export type CreateRecurringPaymentInput = z.input<typeof createRecurringPaymentSchema>;

/**
 * Setting `nextDueOn` moves the schedule: it also becomes the new anchor.
 * The `autoCreate`/amount rule is checked against the stored values.
 */
export const updateRecurringPaymentSchema = z
  .object({
    name: requiredText(60),
    accountId: idSchema.nullable(),
    categoryId: idSchema.nullable(),
    amountMinor: positiveAmountMinorSchema.nullable(),
    frequency: recurrenceFrequencySchema,
    nextDueOn: dateOnlySchema,
    remindDaysBefore: remindDaysSchema,
    autoCreate: z.boolean(),
    active: z.boolean(),
  })
  .partial();

export type UpdateRecurringPaymentInput = z.input<typeof updateRecurringPaymentSchema>;

export const UPCOMING_DAYS = { max: 90, default: 30 } as const;

export const upcomingQuerySchema = z.object({
  days: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(UPCOMING_DAYS.max))
    .optional(),
});

export const upcomingPaymentSchema = z.object({
  recurringPaymentId: idSchema,
  name: z.string(),
  dueOn: dateOnlySchema,
  /** Day to remind (`dueOn - remindDaysBefore`). */
  remindOn: dateOnlySchema,
  amountMinor: z.number().int().nullable(),
  currency: currencyCodeSchema,
  autoCreate: z.boolean(),
});

export type UpcomingPayment = z.infer<typeof upcomingPaymentSchema>;

/** Records the payment of the current due date. `amountMinor` is required for variable amounts. */
export const payRecurringPaymentSchema = z.object({
  amountMinor: positiveAmountMinorSchema.optional(),
  accountId: idSchema.optional(),
  occurredAt: isoDateTimeSchema.optional(),
});

export type PayRecurringPaymentInput = z.input<typeof payRecurringPaymentSchema>;

export const recurringPaymentResultSchema = z.object({
  recurringPayment: recurringPaymentSchema,
  transaction: transactionSchema,
});

export type RecurringPaymentResult = z.infer<typeof recurringPaymentResultSchema>;
