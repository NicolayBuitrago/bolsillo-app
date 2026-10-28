import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../categories';
import { newId } from '../ids';
import {
  createAccountSchema,
  createCategorySchema,
  createTransactionSchema,
  createTransferSchema,
  listAccountsQuerySchema,
  listTransactionsQuerySchema,
  updateSettingsSchema,
} from './index';

const ACCOUNT_A = '0199f0c6-1d7c-7a3e-8f1a-3c1f2b4d5e6f';
const ACCOUNT_B = '0199f0c6-1d7c-7a3e-8f1a-3c1f2b4d5e70';

describe('newId', () => {
  it('generates distinct, time-ordered UUID v7 values', () => {
    const first = newId();
    const second = newId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first).not.toBe(second);
    expect(first < second).toBe(true);
  });
});

describe('createTransactionSchema', () => {
  const valid = {
    id: newId(),
    type: 'expense',
    accountId: ACCOUNT_A,
    amountMinor: 4_590_000,
    occurredAt: '2026-10-28T15:00:00.000Z',
  };

  it('accepts a minimal expense and turns blank text into null', () => {
    const parsed = createTransactionSchema.parse({ ...valid, merchant: '  ', note: ' Almuerzo ' });
    expect(parsed.merchant).toBeNull();
    expect(parsed.note).toBe('Almuerzo');
  });

  it('accepts offsets in occurredAt', () => {
    expect(
      createTransactionSchema.safeParse({ ...valid, occurredAt: '2026-10-28T10:00:00-05:00' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['zero amount', { amountMinor: 0 }],
    ['decimal amount', { amountMinor: 10.5 }],
    ['transfer type', { type: 'transfer_out' }],
    ['non-uuid id', { id: 'abc' }],
    ['date without time', { occurredAt: '2026-10-28' }],
  ])('rejects %s', (_label, patch) => {
    expect(createTransactionSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe('createTransferSchema', () => {
  it('rejects the same account on both sides', () => {
    const result = createTransferSchema.safeParse({
      id: newId(),
      fromAccountId: ACCOUNT_A,
      toAccountId: ACCOUNT_A,
      amountMinor: 100,
      occurredAt: '2026-10-28T15:00:00Z',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['toAccountId']);
  });

  it('accepts two different accounts', () => {
    expect(
      createTransferSchema.safeParse({
        id: newId(),
        fromAccountId: ACCOUNT_A,
        toAccountId: ACCOUNT_B,
        amountMinor: 100,
        occurredAt: '2026-10-28T15:00:00Z',
      }).success,
    ).toBe(true);
  });
});

describe('query schemas', () => {
  it('parses pagination and filters from query strings', () => {
    expect(
      listTransactionsQuerySchema.parse({ limit: '20', from: '2026-10-01', q: ' éxito ' }),
    ).toEqual({ limit: 20, from: '2026-10-01', q: 'éxito' });
  });

  it.each(['0', '101', 'ten', '-1'])('rejects limit=%s', (limit) => {
    expect(listTransactionsQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it('parses query booleans', () => {
    expect(listAccountsQuerySchema.parse({ includeArchived: 'true' })).toEqual({
      includeArchived: true,
    });
    expect(listAccountsQuerySchema.parse({})).toEqual({});
    expect(listAccountsQuerySchema.safeParse({ includeArchived: 'yes' }).success).toBe(false);
  });
});

describe('accounts, categories and settings', () => {
  it('validates last4, colors and icons', () => {
    const base = { name: 'Nequi', type: 'digital_wallet' };
    expect(createAccountSchema.safeParse({ ...base, last4: '1234' }).success).toBe(true);
    expect(createAccountSchema.safeParse({ ...base, last4: '12a4' }).success).toBe(false);
    expect(createAccountSchema.safeParse({ ...base, color: 'red' }).success).toBe(false);
    expect(
      createCategorySchema.safeParse({ name: 'X', kind: 'expense', icon: 'nope' }).success,
    ).toBe(false);
  });

  it('allows negative initial balances (credit card debt)', () => {
    expect(
      createAccountSchema.parse({ name: 'Visa', type: 'credit_card', initialBalanceMinor: -5000 })
        .initialBalanceMinor,
    ).toBe(-5000);
  });

  it('limits the capture retention window', () => {
    expect(updateSettingsSchema.safeParse({ captureBodyRetentionDays: 3 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ timezone: 'Mars/Base' }).success).toBe(false);
    expect(updateSettingsSchema.parse({ timezone: 'America/Bogota' })).toEqual({
      timezone: 'America/Bogota',
    });
  });
});

describe('DEFAULT_CATEGORIES', () => {
  it('has unique names per kind and one system adjustment per kind', () => {
    const keys = DEFAULT_CATEGORIES.map((category) => `${category.kind}:${category.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    const system = DEFAULT_CATEGORIES.filter((category) => category.isSystem);
    expect(system.map((category) => category.kind).sort()).toEqual(['expense', 'income']);
  });

  it('only uses valid names', () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(createCategorySchema.safeParse(category).success).toBe(true);
    }
  });
});
