import type { Transaction } from '@bolsillo/core/schemas';
import type { TransactionRow } from './repository';

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    type: row.type,
    status: row.status,
    source: row.source,
    amountMinor: row.amountMinor,
    currency: row.currency,
    occurredAt: row.occurredAt.toISOString(),
    merchant: row.merchant,
    note: row.note,
    transferGroupId: row.transferGroupId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
