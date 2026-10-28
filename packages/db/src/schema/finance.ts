import { DEFAULT_CURRENCY } from '@bolsillo/core/money';
import { CAPTURE_RETENTION_DAYS } from '@bolsillo/core/schemas';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { currency, minor, primaryId, timestamps, timestamptz } from './columns';
import {
  accountType,
  categoryKind,
  recurrenceFrequency,
  transactionSource,
  transactionStatus,
  transactionType,
} from './enums';

const userId = () =>
  uuid()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' });

export const userSettings = pgTable('user_settings', {
  userId: uuid()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  defaultCurrency: currency().notNull().default(DEFAULT_CURRENCY),
  timezone: text().notNull().default('America/Bogota'),
  llmExtractionEnabled: boolean().notNull().default(false),
  captureBodyRetentionDays: integer().notNull().default(CAPTURE_RETENTION_DAYS.default),
  emailCaptureAddressToken: text().unique('user_settings_email_capture_address_token_key'),
  ...timestamps,
});

export const financialAccounts = pgTable(
  'financial_accounts',
  {
    id: primaryId(),
    userId: userId(),
    name: text().notNull(),
    type: accountType().notNull(),
    institution: text(),
    last4: char({ length: 4 }),
    currency: currency().notNull().default(DEFAULT_CURRENCY),
    initialBalanceMinor: minor().notNull().default(0),
    creditLimitMinor: minor(),
    color: text(),
    icon: text(),
    archivedAt: timestamptz(),
    ...timestamps,
  },
  (table) => [
    index().on(table.userId),
    uniqueIndex('financial_accounts_user_id_name_active_key')
      .on(table.userId, table.name)
      .where(sql`${table.archivedAt} is null`),
    // Target of composite foreign keys that keep references inside one user.
    unique('financial_accounts_user_id_id_key').on(table.userId, table.id),
    check('financial_accounts_credit_limit_check', sql`${table.creditLimitMinor} > 0`),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: primaryId(),
    userId: userId(),
    parentId: uuid(),
    name: text().notNull(),
    kind: categoryKind().notNull(),
    isSystem: boolean().notNull().default(false),
    color: text(),
    icon: text(),
    archivedAt: timestamptz(),
    ...timestamps,
  },
  (table) => [
    index().on(table.userId),
    unique('categories_user_id_id_key').on(table.userId, table.id),
    foreignKey({
      name: 'categories_parent_fk',
      columns: [table.userId, table.parentId],
      foreignColumns: [table.userId, table.id] as [AnyPgColumn, AnyPgColumn],
    }),
  ],
);

export const recurringPayments = pgTable(
  'recurring_payments',
  {
    id: primaryId(),
    userId: userId(),
    name: text().notNull(),
    accountId: uuid(),
    categoryId: uuid(),
    /** Null = variable amount. */
    amountMinor: minor(),
    currency: currency().notNull(),
    frequency: recurrenceFrequency().notNull(),
    /** First due date; later ones keep its day of month. */
    anchorOn: date({ mode: 'string' }).notNull(),
    nextDueOn: date({ mode: 'string' }).notNull(),
    remindDaysBefore: integer().notNull().default(2),
    autoCreate: boolean().notNull().default(false),
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index().on(table.userId),
    // Daily job: active auto-create payments that are due.
    index('recurring_payments_due_idx')
      .on(table.nextDueOn)
      .where(sql`${table.active} and ${table.autoCreate}`),
    unique('recurring_payments_user_id_id_key').on(table.userId, table.id),
    foreignKey({
      name: 'recurring_payments_account_fk',
      columns: [table.userId, table.accountId],
      foreignColumns: [financialAccounts.userId, financialAccounts.id],
    }),
    foreignKey({
      name: 'recurring_payments_category_fk',
      columns: [table.userId, table.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    check('recurring_payments_amount_check', sql`${table.amountMinor} > 0`),
    check(
      'recurring_payments_auto_create_check',
      sql`not ${table.autoCreate} or ${table.amountMinor} is not null`,
    ),
    check('recurring_payments_remind_check', sql`${table.remindDaysBefore} between 0 and 30`),
  ],
);

export const budgets = pgTable(
  'budgets',
  {
    id: primaryId(),
    userId: userId(),
    categoryId: uuid().notNull(),
    amountMinor: minor().notNull(),
    currency: currency().notNull(),
    /** First day of the first month the budget applies to. */
    startsOn: date({ mode: 'string' }).notNull(),
    archivedAt: timestamptz(),
    ...timestamps,
  },
  (table) => [
    index().on(table.userId),
    uniqueIndex('budgets_user_category_active_key')
      .on(table.userId, table.categoryId)
      .where(sql`${table.archivedAt} is null`),
    foreignKey({
      name: 'budgets_category_fk',
      columns: [table.userId, table.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    check('budgets_amount_positive_check', sql`${table.amountMinor} > 0`),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    /** UUID v7 generated by the client for idempotency. */
    id: uuid().primaryKey(),
    userId: userId(),
    accountId: uuid(),
    categoryId: uuid(),
    type: transactionType().notNull(),
    status: transactionStatus().notNull(),
    source: transactionSource().notNull(),
    amountMinor: minor().notNull(),
    currency: currency().notNull(),
    occurredAt: timestamptz().notNull(),
    merchant: text(),
    merchantNormalized: text(),
    note: text(),
    transferGroupId: uuid(),
    recurringPaymentId: uuid(),
    confirmedAt: timestamptz(),
    deletedAt: timestamptz(),
    ...timestamps,
  },
  (table) => [
    index('transactions_user_occurred_idx').on(
      table.userId,
      table.occurredAt.desc(),
      table.id.desc(),
    ),
    index('transactions_user_account_occurred_idx').on(
      table.userId,
      table.accountId,
      table.occurredAt,
    ),
    index('transactions_user_pending_idx')
      .on(table.userId, table.status)
      .where(sql`${table.status} = 'pending'`),
    index('transactions_user_amount_occurred_idx').on(
      table.userId,
      table.amountMinor,
      table.occurredAt,
    ),
    // At most one transfer_out and one transfer_in per group.
    uniqueIndex('transactions_transfer_group_type_key')
      .on(table.transferGroupId, table.type)
      .where(sql`${table.transferGroupId} is not null`),
    foreignKey({
      name: 'transactions_account_fk',
      columns: [table.userId, table.accountId],
      foreignColumns: [financialAccounts.userId, financialAccounts.id],
    }),
    foreignKey({
      name: 'transactions_category_fk',
      columns: [table.userId, table.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    foreignKey({
      name: 'transactions_recurring_payment_fk',
      columns: [table.userId, table.recurringPaymentId],
      foreignColumns: [recurringPayments.userId, recurringPayments.id],
    }),
    // One active transaction per recurring due date (the job's safety net).
    uniqueIndex('transactions_recurring_occurrence_key')
      .on(table.recurringPaymentId, table.occurredAt)
      .where(sql`${table.recurringPaymentId} is not null and ${table.deletedAt} is null`),
    check('transactions_amount_positive_check', sql`${table.amountMinor} > 0`),
    check(
      'transactions_account_required_check',
      sql`${table.accountId} is not null or ${table.status} = 'pending'`,
    ),
    check(
      'transactions_transfer_group_check',
      sql`(${table.transferGroupId} is not null) = (${table.type} in ('transfer_out', 'transfer_in'))`,
    ),
  ],
);
