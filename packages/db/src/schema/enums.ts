import {
  ACCOUNT_TYPES,
  CATEGORY_KINDS,
  TRANSACTION_SOURCES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from '@bolsillo/core/schemas';
import { pgEnum } from 'drizzle-orm/pg-core';

export const accountType = pgEnum('account_type', ACCOUNT_TYPES);
export const categoryKind = pgEnum('category_kind', CATEGORY_KINDS);
export const transactionType = pgEnum('transaction_type', TRANSACTION_TYPES);
export const transactionStatus = pgEnum('transaction_status', TRANSACTION_STATUSES);
export const transactionSource = pgEnum('transaction_source', TRANSACTION_SOURCES);
