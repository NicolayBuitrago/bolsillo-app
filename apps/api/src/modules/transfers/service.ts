import { newId } from '@bolsillo/core/ids';
import type { createTransferSchema, Transfer } from '@bolsillo/core/schemas';
import type { Database } from '@bolsillo/db';
import type { z } from 'zod';
import { BusinessRuleError, ConflictError } from '../../errors';
import { isUniqueViolation } from '../../lib/pg-errors';
import type { AccountsService } from '../accounts/service';
import { toTransaction } from '../transactions/dto';
import { findTransferRows, insertTransfer, type TransactionRow } from '../transactions/repository';

type CreateTransfer = z.infer<typeof createTransferSchema>;

const TRANSFER_GROUP_KEY = 'transactions_transfer_group_type_key';

function toTransfer(id: string, rows: TransactionRow[]): Transfer {
  const out = rows.find((row) => row.type === 'transfer_out');
  const incoming = rows.find((row) => row.type === 'transfer_in');
  if (!out || !incoming) throw new Error('Transfer is missing one of its rows');
  return { id, out: toTransaction(out), in: toTransaction(incoming) };
}

function isSameTransfer(rows: TransactionRow[], input: CreateTransfer): boolean {
  const out = rows.find((row) => row.type === 'transfer_out');
  const incoming = rows.find((row) => row.type === 'transfer_in');
  return (
    out !== undefined &&
    incoming !== undefined &&
    out.accountId === input.fromAccountId &&
    incoming.accountId === input.toAccountId &&
    out.amountMinor === input.amountMinor &&
    out.occurredAt.getTime() === new Date(input.occurredAt).getTime() &&
    out.note === (input.note ?? null)
  );
}

export interface TransfersServiceDeps {
  db: Database;
  accounts: AccountsService;
}

export function createTransfersService({ db, accounts }: TransfersServiceDeps) {
  async function replay(userId: string, input: CreateTransfer) {
    const rows = await findTransferRows(db, userId, input.id);
    if (rows.length === 0) return undefined;
    if (!isSameTransfer(rows, input)) {
      throw new ConflictError('Ya existe una transferencia con ese id y datos distintos');
    }
    return { transfer: toTransfer(input.id, rows), created: false };
  }

  return {
    /**
     * Creates the `transfer_out` / `transfer_in` pair in one database
     * transaction. `id` becomes the transfer group id, so retries are idempotent.
     */
    async create(
      userId: string,
      input: CreateTransfer,
    ): Promise<{ transfer: Transfer; created: boolean }> {
      const existing = await replay(userId, input);
      if (existing) return existing;

      const from = await accounts.assertUsable(userId, input.fromAccountId);
      const to = await accounts.assertUsable(userId, input.toAccountId);
      if (from.currency !== to.currency) {
        throw new BusinessRuleError('Las cuentas de una transferencia deben tener la misma moneda');
      }

      const now = new Date();
      const shared = {
        transferGroupId: input.id,
        status: 'confirmed' as const,
        source: 'manual' as const,
        amountMinor: input.amountMinor,
        currency: from.currency,
        occurredAt: new Date(input.occurredAt),
        note: input.note ?? null,
        confirmedAt: now,
      };
      try {
        const rows = await insertTransfer(
          db,
          userId,
          { ...shared, id: newId(), type: 'transfer_out', accountId: from.id },
          { ...shared, id: newId(), type: 'transfer_in', accountId: to.id },
        );
        return { transfer: toTransfer(input.id, rows), created: true };
      } catch (error) {
        if (!isUniqueViolation(error, TRANSFER_GROUP_KEY)) throw error;
        // Concurrent retry, or the id belongs to someone else.
        const raced = await replay(userId, input);
        if (raced) return raced;
        throw new ConflictError('Ya existe una transferencia con ese id y datos distintos');
      }
    },
  };
}

export type TransfersService = ReturnType<typeof createTransfersService>;
