import { z } from 'zod';
import { colorSchema, iconKeySchema } from '../categories/icons';
import { amountMinorSchema, currencyCodeSchema, positiveAmountMinorSchema } from '../money';
import { isoDateTimeSchema, optionalText, queryBooleanSchema, requiredText } from './common';

export const ACCOUNT_TYPES = [
  'bank',
  'credit_card',
  'cash',
  'digital_wallet',
  'savings',
  'other',
] as const;

export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof accountTypeSchema>;

const last4Schema = z
  .string()
  .regex(/^\d{4}$/, 'Expected the last 4 digits')
  .nullable()
  .optional();

export const accountSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: accountTypeSchema,
  institution: z.string().nullable(),
  last4: z.string().nullable(),
  currency: currencyCodeSchema,
  initialBalanceMinor: amountMinorSchema,
  creditLimitMinor: amountMinorSchema.nullable(),
  /** initial + income + transfer_in − expense − transfer_out (confirmed, not deleted). */
  balanceMinor: amountMinorSchema,
  color: z.string().nullable(),
  icon: z.string().nullable(),
  archivedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Account = z.infer<typeof accountSchema>;

const accountFields = {
  name: requiredText(60),
  type: accountTypeSchema,
  institution: optionalText(60),
  last4: last4Schema,
  initialBalanceMinor: amountMinorSchema.optional(),
  creditLimitMinor: positiveAmountMinorSchema.nullable().optional(),
  color: colorSchema.nullable().optional(),
  icon: iconKeySchema.nullable().optional(),
};

/** Currency defaults to the user's default currency and cannot change later. */
export const createAccountSchema = z.object({
  ...accountFields,
  currency: currencyCodeSchema.optional(),
});

export type CreateAccountInput = z.input<typeof createAccountSchema>;

export const updateAccountSchema = z.object(accountFields).partial();

export type UpdateAccountInput = z.input<typeof updateAccountSchema>;

export const listAccountsQuerySchema = z.object({ includeArchived: queryBooleanSchema });

export const adjustBalanceSchema = z.object({
  actualBalanceMinor: amountMinorSchema,
  occurredAt: isoDateTimeSchema.optional(),
});

export type AdjustBalanceInput = z.input<typeof adjustBalanceSchema>;
