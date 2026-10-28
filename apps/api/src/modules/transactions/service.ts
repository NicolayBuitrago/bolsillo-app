import { endOfDayInZone, startOfDayInZone } from '@bolsillo/core/dates';
import {
  type createTransactionSchema,
  type listTransactionsQuerySchema,
  PAGE_LIMIT_DEFAULT,
  type Page,
  type Transaction,
  type updateTransactionSchema,
} from '@bolsillo/core/schemas';
import type { Database } from '@bolsillo/db';
import type { z } from 'zod';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../errors';
import { decodeCursor, encodeCursor } from '../../lib/cursor';
import type { AccountsService } from '../accounts/service';
import type { CategoriesService } from '../categories/service';
import type { SettingsService } from '../settings/service';
import { toTransaction } from './dto';
import {
  findTransaction,
  findTransactionIncludingDeleted,
  insertTransaction,
  listTransactions,
  softDeleteTransaction,
  type TransactionPatch,
  type TransactionRow,
  updateTransaction,
  updateTransferRows,
} from './repository';

type CreateTransaction = z.infer<typeof createTransactionSchema>;
type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
type ListQuery = z.infer<typeof listTransactionsQuerySchema>;

const TRANSFER_EDITABLE = new Set(['amountMinor', 'occurredAt', 'note']);

/** Same request as the stored transaction (idempotent retry)? */
function isSameEntry(row: TransactionRow, input: CreateTransaction): boolean {
  return (
    row.source === 'manual' &&
    row.type === input.type &&
    row.accountId === input.accountId &&
    row.categoryId === (input.categoryId ?? null) &&
    row.amountMinor === input.amountMinor &&
    row.occurredAt.getTime() === new Date(input.occurredAt).getTime() &&
    row.merchant === (input.merchant ?? null) &&
    row.note === (input.note ?? null)
  );
}

function isTransfer(row: TransactionRow): boolean {
  return row.transferGroupId !== null;
}

export interface TransactionsServiceDeps {
  db: Database;
  settings: SettingsService;
  accounts: AccountsService;
  categories: CategoriesService;
}

export function createTransactionsService({
  db,
  settings,
  accounts,
  categories,
}: TransactionsServiceDeps) {
  async function requireTransaction(userId: string, id: string): Promise<TransactionRow> {
    const row = await findTransaction(db, userId, id);
    if (!row) throw new NotFoundError('Movimiento no encontrado');
    return row;
  }

  function replay(row: TransactionRow, input: CreateTransaction) {
    if (!isSameEntry(row, input)) {
      throw new ConflictError('Ya existe un movimiento con ese id y datos distintos');
    }
    return { transaction: toTransaction(row), created: false };
  }

  async function updateTransfer(userId: string, row: TransactionRow, input: UpdateTransaction) {
    const blocked = Object.entries(input).filter(
      ([key, value]) => value !== undefined && !TRANSFER_EDITABLE.has(key),
    );
    if (blocked.length > 0) {
      throw new BusinessRuleError(
        'En una transferencia solo se pueden cambiar el monto, la fecha y la nota',
        { fields: blocked.map(([key]) => key) },
      );
    }
    const rows = await updateTransferRows(db, userId, row.transferGroupId as string, {
      amountMinor: input.amountMinor,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
      note: input.note,
    });
    const updated = rows.find((candidate) => candidate.id === row.id);
    if (!updated) throw new NotFoundError('Movimiento no encontrado');
    return toTransaction(updated);
  }

  return {
    async list(userId: string, query: ListQuery): Promise<Page<Transaction>> {
      const { timezone } = await settings.load(userId);
      const limit = query.limit ?? PAGE_LIMIT_DEFAULT;
      const rows = await listTransactions(db, userId, {
        ...(query.from ? { start: startOfDayInZone(query.from, timezone) } : {}),
        ...(query.to ? { end: endOfDayInZone(query.to, timezone) } : {}),
        ...(query.accountId ? { accountId: query.accountId } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.source ? { source: query.source } : {}),
        ...(query.q ? { q: query.q } : {}),
        ...(query.cursor ? { after: decodeCursor(query.cursor) } : {}),
        limit: limit + 1,
      });
      const items = rows.slice(0, limit);
      const last = items.at(-1);
      return {
        items: items.map(toTransaction),
        nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
      };
    },

    async get(userId: string, id: string): Promise<Transaction> {
      return toTransaction(await requireTransaction(userId, id));
    },

    /**
     * Creates a confirmed manual expense or income. Retrying with the same `id`
     * and data returns the stored transaction (`created: false`); the same `id`
     * with different data is a conflict.
     */
    async create(
      userId: string,
      input: CreateTransaction,
    ): Promise<{ transaction: Transaction; created: boolean }> {
      const existing = await findTransactionIncludingDeleted(db, userId, input.id);
      if (existing) return replay(existing, input);

      const account = await accounts.assertUsable(userId, input.accountId);
      await categories.assertUsable(userId, input.categoryId, input.type);

      const now = new Date();
      const row = await insertTransaction(db, userId, {
        id: input.id,
        accountId: account.id,
        categoryId: input.categoryId ?? null,
        type: input.type,
        status: 'confirmed',
        source: 'manual',
        amountMinor: input.amountMinor,
        currency: account.currency,
        occurredAt: new Date(input.occurredAt),
        merchant: input.merchant ?? null,
        note: input.note ?? null,
        confirmedAt: now,
      });
      if (row) return { transaction: toTransaction(row), created: true };

      // Lost a race with a concurrent retry, or the id belongs to someone else.
      const raced = await findTransactionIncludingDeleted(db, userId, input.id);
      if (raced) return replay(raced, input);
      throw new ConflictError('Ya existe un movimiento con ese id y datos distintos');
    },

    async update(userId: string, id: string, input: UpdateTransaction): Promise<Transaction> {
      const current = await requireTransaction(userId, id);
      if (isTransfer(current)) return updateTransfer(userId, current, input);

      const type = input.type ?? (current.type as 'expense' | 'income');
      const patch: TransactionPatch = {
        type,
        amountMinor: input.amountMinor,
        merchant: input.merchant,
        note: input.note,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
      };
      if (input.accountId && input.accountId !== current.accountId) {
        const account = await accounts.assertUsable(userId, input.accountId);
        patch.accountId = account.id;
        patch.currency = account.currency;
      }
      const categoryId = input.categoryId === undefined ? current.categoryId : input.categoryId;
      if (input.categoryId !== undefined || type !== current.type) {
        await categories.assertUsable(userId, categoryId, type);
        patch.categoryId = categoryId;
      }
      const row = await updateTransaction(db, userId, id, patch);
      if (!row) throw new NotFoundError('Movimiento no encontrado');
      return toTransaction(row);
    },

    /** Soft delete; deleting either row of a transfer deletes both. */
    async remove(userId: string, id: string): Promise<void> {
      const current = await requireTransaction(userId, id);
      await softDeleteTransaction(
        db,
        userId,
        current.transferGroupId ? { groupId: current.transferGroupId } : { id },
      );
    },
  };
}

export type TransactionsService = ReturnType<typeof createTransactionsService>;
