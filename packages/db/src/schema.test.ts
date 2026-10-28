import { DEFAULT_CATEGORIES } from '@bolsillo/core/categories';
import { newId } from '@bolsillo/core/ids';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureUserDefaults } from './defaults';
import { categories, financialAccounts, transactions, user, userSettings } from './schema';
import { createTemporaryDatabase, type TemporaryDatabase } from './testing';

let tmp: TemporaryDatabase;

beforeAll(async () => {
  tmp = await createTemporaryDatabase();
});

afterAll(async () => {
  await tmp.destroy();
});

async function createUser(email: string): Promise<string> {
  const [row] = await tmp.db.insert(user).values({ name: 'Test', email }).returning();
  if (!row) throw new Error('user not created');
  return row.id;
}

async function createAccount(userId: string, name = 'Nequi'): Promise<string> {
  const [row] = await tmp.db
    .insert(financialAccounts)
    .values({ userId, name, type: 'digital_wallet' })
    .returning();
  if (!row) throw new Error('account not created');
  return row.id;
}

function expense(userId: string, accountId: string | null) {
  return {
    id: newId(),
    userId,
    accountId,
    type: 'expense' as const,
    status: 'confirmed' as const,
    source: 'manual' as const,
    amountMinor: 4_590_000,
    currency: 'COP' as const,
    occurredAt: new Date(),
  };
}

/** Postgres wraps constraint errors; drizzle exposes the original as `cause`. */
async function constraintOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: { constraint?: string } }).cause;
    return cause?.constraint;
  }
  return undefined;
}

describe('ensureUserDefaults', () => {
  it('creates settings and the default category tree once', async () => {
    const userId = await createUser('defaults@test.local');

    await expect(ensureUserDefaults(tmp.db, userId)).resolves.toBe(true);
    await expect(ensureUserDefaults(tmp.db, userId)).resolves.toBe(false);

    const settings = await tmp.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    expect(settings[0]).toMatchObject({ defaultCurrency: 'COP', timezone: 'America/Bogota' });

    const rows = await tmp.db.select().from(categories).where(eq(categories.userId, userId));
    const expected = DEFAULT_CATEGORIES.reduce(
      (total, category) => total + 1 + (category.children?.length ?? 0),
      0,
    );
    expect(rows).toHaveLength(expected);
    expect(rows.filter((row) => row.isSystem)).toHaveLength(2);

    const food = rows.find((row) => row.name === 'Alimentación');
    const groceries = rows.find((row) => row.name === 'Mercado');
    expect(groceries?.parentId).toBe(food?.id);
  });

  it('is safe when called concurrently', async () => {
    const userId = await createUser('concurrent@test.local');
    const results = await Promise.all([
      ensureUserDefaults(tmp.db, userId),
      ensureUserDefaults(tmp.db, userId),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const top = await tmp.db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, userId), isNull(categories.parentId)));
    expect(top).toHaveLength(DEFAULT_CATEGORIES.length);
  });
});

describe('constraints', () => {
  it('rejects referencing another user account or category', async () => {
    const alice = await createUser('alice@test.local');
    const bob = await createUser('bob@test.local');
    const bobAccount = await createAccount(bob);
    await ensureUserDefaults(tmp.db, bob);
    const [bobCategory] = await tmp.db.select().from(categories).where(eq(categories.userId, bob));

    expect(await constraintOf(tmp.db.insert(transactions).values(expense(alice, bobAccount)))).toBe(
      'transactions_account_fk',
    );

    const aliceAccount = await createAccount(alice);
    expect(
      await constraintOf(
        tmp.db
          .insert(transactions)
          .values({ ...expense(alice, aliceAccount), categoryId: bobCategory?.id ?? null }),
      ),
    ).toBe('transactions_category_fk');

    expect(
      await constraintOf(
        tmp.db
          .insert(categories)
          .values({ userId: alice, name: 'X', kind: 'expense', parentId: bobCategory?.id ?? null }),
      ),
    ).toBe('categories_parent_fk');
  });

  it('enforces amount, account and transfer rules', async () => {
    const userId = await createUser('rules@test.local');
    const accountId = await createAccount(userId);

    expect(
      await constraintOf(
        tmp.db.insert(transactions).values({ ...expense(userId, accountId), amountMinor: 0 }),
      ),
    ).toBe('transactions_amount_positive_check');
    expect(await constraintOf(tmp.db.insert(transactions).values(expense(userId, null)))).toBe(
      'transactions_account_required_check',
    );
    expect(
      await constraintOf(
        tmp.db.insert(transactions).values({ ...expense(userId, accountId), type: 'transfer_out' }),
      ),
    ).toBe('transactions_transfer_group_check');

    // A pending capture may not have an account yet.
    await tmp.db.insert(transactions).values({ ...expense(userId, null), status: 'pending' });

    const groupId = newId();
    const transferOut = { ...expense(userId, accountId), type: 'transfer_out' as const };
    await tmp.db.insert(transactions).values({ ...transferOut, transferGroupId: groupId });
    expect(
      await constraintOf(
        tmp.db
          .insert(transactions)
          .values({ ...transferOut, id: newId(), transferGroupId: groupId }),
      ),
    ).toBe('transactions_transfer_group_type_key');
  });

  it('keeps account names unique among active accounts only', async () => {
    const userId = await createUser('names@test.local');
    const first = await createAccount(userId, 'Ahorros');
    expect(await constraintOf(createAccount(userId, 'Ahorros'))).toBe(
      'financial_accounts_user_id_name_active_key',
    );
    await tmp.db
      .update(financialAccounts)
      .set({ archivedAt: new Date() })
      .where(eq(financialAccounts.id, first));
    await expect(createAccount(userId, 'Ahorros')).resolves.toBeTypeOf('string');
  });

  it('deletes all user data when the user is deleted', async () => {
    const userId = await createUser('cascade@test.local');
    const accountId = await createAccount(userId);
    await ensureUserDefaults(tmp.db, userId);
    await tmp.db.insert(transactions).values(expense(userId, accountId));

    await tmp.db.delete(user).where(eq(user.id, userId));

    const left = await tmp.db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(left).toHaveLength(0);
  });
});
