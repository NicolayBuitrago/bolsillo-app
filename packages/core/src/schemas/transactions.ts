import { z } from 'zod';
import { currencyCodeSchema, positiveAmountMinorSchema } from '../money';
import {
  dateOnlySchema,
  idSchema,
  isoDateTimeSchema,
  optionalText,
  paginationQuerySchema,
} from './common';

export const TRANSACTION_TYPES = ['expense', 'income', 'transfer_out', 'transfer_in'] as const;
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const TRANSACTION_STATUSES = ['pending', 'confirmed'] as const;
export const transactionStatusSchema = z.enum(TRANSACTION_STATUSES);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

export const TRANSACTION_SOURCES = [
  'manual',
  'notification',
  'email',
  'shortcut',
  'recurring',
  'import',
] as const;
export const transactionSourceSchema = z.enum(TRANSACTION_SOURCES);
export type TransactionSource = z.infer<typeof transactionSourceSchema>;

/** Types a user can create directly; transfers go through `/v1/transfers`. */
export const entryTypeSchema = z.enum(['expense', 'income']);
export type EntryType = z.infer<typeof entryTypeSchema>;

export const transactionSchema = z.object({
  id: idSchema,
  accountId: idSchema.nullable(),
  categoryId: idSchema.nullable(),
  type: transactionTypeSchema,
  status: transactionStatusSchema,
  source: transactionSourceSchema,
  amountMinor: positiveAmountMinorSchema,
  currency: currencyCodeSchema,
  occurredAt: isoDateTimeSchema,
  merchant: z.string().nullable(),
  note: z.string().nullable(),
  transferGroupId: idSchema.nullable(),
  confirmedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Transaction = z.infer<typeof transactionSchema>;

const MERCHANT_MAX = 120;
const NOTE_MAX = 500;

/**
 * Manual expense or income. `id` is a client-generated UUID v7: sending the
 * same request again returns the existing transaction instead of a duplicate.
 * The currency comes from the account.
 */
export const createTransactionSchema = z.object({
  id: idSchema,
  type: entryTypeSchema,
  accountId: idSchema,
  categoryId: idSchema.nullable().optional(),
  amountMinor: positiveAmountMinorSchema,
  occurredAt: isoDateTimeSchema,
  merchant: optionalText(MERCHANT_MAX),
  note: optionalText(NOTE_MAX),
});

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;

/** On transfer rows only `amountMinor`, `occurredAt` and `note` may change (both rows). */
export const updateTransactionSchema = createTransactionSchema.omit({ id: true }).partial();

export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;

export const listTransactionsQuerySchema = paginationQuerySchema.extend({
  /** Inclusive start date in the user's time zone. */
  from: dateOnlySchema.optional(),
  /** Inclusive end date in the user's time zone. */
  to: dateOnlySchema.optional(),
  accountId: idSchema.optional(),
  /** Also matches the category's subcategories. */
  categoryId: idSchema.optional(),
  type: transactionTypeSchema.optional(),
  status: transactionStatusSchema.optional(),
  source: transactionSourceSchema.optional(),
  /** Case-insensitive search in merchant and note. */
  q: z.string().trim().min(1).max(100).optional(),
});

export type ListTransactionsQuery = z.input<typeof listTransactionsQuerySchema>;
