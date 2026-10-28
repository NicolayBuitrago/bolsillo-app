import { z } from 'zod';
import { positiveAmountMinorSchema } from '../money';
import { idSchema, isoDateTimeSchema, optionalText } from './common';
import { transactionSchema } from './transactions';

/**
 * Transfer between two of the user's accounts. `id` is client-generated and
 * becomes the `transferGroupId` of both rows, so retries are idempotent.
 */
export const createTransferSchema = z
  .object({
    id: idSchema,
    fromAccountId: idSchema,
    toAccountId: idSchema,
    amountMinor: positiveAmountMinorSchema,
    occurredAt: isoDateTimeSchema,
    note: optionalText(500),
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: 'Las cuentas de origen y destino deben ser distintas',
    path: ['toAccountId'],
  });

export type CreateTransferInput = z.input<typeof createTransferSchema>;

export const transferSchema = z.object({
  id: idSchema,
  out: transactionSchema,
  in: transactionSchema,
});

export type Transfer = z.infer<typeof transferSchema>;
