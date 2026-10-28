import { newId } from '@bolsillo/core/ids';
import type {
  Account,
  CategoryTreeNode,
  Page,
  Transaction,
  Transfer,
} from '@bolsillo/core/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  balanceOf,
  categoryId,
  createAccount,
  createTransaction,
  errorCode,
  transactionInput,
} from '../test/fixtures';
import { createTestContext, json, signUp, type TestUser } from '../test/helpers';

/**
 * Acceptance criterion (phase 1): user A gets 404 when reading, editing or
 * deleting any resource of user B, and never sees B's data in listings.
 */
let ctx: Awaited<ReturnType<typeof createTestContext>>;
let alice: TestUser;
let bob: TestUser;
let bobAccount: Account;
let bobSecondAccount: Account;
let bobCategoryId: string;
let bobTransaction: Transaction;
let bobTransfer: Transfer;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await signUp(ctx.app);
  bob = await signUp(ctx.app);
  bobAccount = await createAccount(bob, { name: 'Ahorros Bob', initialBalanceMinor: 100_000_00 });
  bobSecondAccount = await createAccount(bob, { name: 'Nequi Bob' });
  bobCategoryId = await categoryId(bob, 'Mercado');
  bobTransaction = await createTransaction(bob, bobAccount.id, {
    categoryId: bobCategoryId,
    merchant: 'Tienda de Bob',
  });
  bobTransfer = await json<Transfer>(
    await bob.post('/v1/transfers', {
      id: newId(),
      fromAccountId: bobAccount.id,
      toAccountId: bobSecondAccount.id,
      amountMinor: 50_000_00,
      occurredAt: '2026-10-16T12:00:00Z',
    }),
  );
});

afterAll(async () => {
  await ctx.destroy();
});

async function expectNotFound(res: Promise<Response>) {
  const response = await res;
  expect(response.status).toBe(404);
  expect(await errorCode(response)).toBe('NOT_FOUND');
}

describe('user isolation', () => {
  it('hides accounts of other users', async () => {
    await expectNotFound(alice.patch(`/v1/accounts/${bobAccount.id}`, { name: 'Mía' }));
    await expectNotFound(alice.post(`/v1/accounts/${bobAccount.id}/archive`));
    await expectNotFound(
      alice.post(`/v1/accounts/${bobAccount.id}/adjust-balance`, { actualBalanceMinor: 0 }),
    );
    const list = await json<Account[]>(await alice.get('/v1/accounts?includeArchived=true'));
    expect(list).toEqual([]);
  });

  it('hides categories of other users', async () => {
    await expectNotFound(alice.patch(`/v1/categories/${bobCategoryId}`, { name: 'Mía' }));
    await expectNotFound(alice.post(`/v1/categories/${bobCategoryId}/archive`));
    const tree = await json<CategoryTreeNode[]>(await alice.get('/v1/categories'));
    const ids = tree.flatMap((node) => [node.id, ...node.children.map((child) => child.id)]);
    expect(ids).not.toContain(bobCategoryId);
  });

  it('hides transactions and transfers of other users', async () => {
    for (const id of [bobTransaction.id, bobTransfer.out.id, bobTransfer.in.id]) {
      await expectNotFound(alice.get(`/v1/transactions/${id}`));
      await expectNotFound(alice.patch(`/v1/transactions/${id}`, { note: 'hackeado' }));
      await expectNotFound(alice.delete(`/v1/transactions/${id}`));
    }
    const page = await json<Page<Transaction>>(await alice.get('/v1/transactions'));
    expect(page.items).toEqual([]);
  });

  it("does not let a user reference another user's accounts or categories", async () => {
    const own = await createAccount(alice);
    await expectNotFound(alice.post('/v1/transactions', transactionInput(bobAccount.id)));
    await expectNotFound(
      alice.post('/v1/transactions', transactionInput(own.id, { categoryId: bobCategoryId })),
    );
    await expectNotFound(
      alice.patch(`/v1/transactions/${(await createTransaction(alice, own.id)).id}`, {
        accountId: bobAccount.id,
      }),
    );
    await expectNotFound(
      alice.post('/v1/transfers', {
        id: newId(),
        fromAccountId: own.id,
        toAccountId: bobAccount.id,
        amountMinor: 100,
        occurredAt: '2026-10-16T12:00:00Z',
      }),
    );
    await expectNotFound(
      alice.post('/v1/categories', { name: 'Hija', kind: 'expense', parentId: bobCategoryId }),
    );
  });

  it("answers 409 without leaking data when reusing another user's transaction id", async () => {
    const own = await createAccount(alice);
    const res = await alice.post(
      '/v1/transactions',
      transactionInput(own.id, { id: bobTransaction.id }),
    );
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).not.toContain('Tienda de Bob');
  });

  it("leaves the other user's data untouched", async () => {
    const res = await bob.get(`/v1/transactions/${bobTransaction.id}`);
    expect(res.status).toBe(200);
    expect(await json<Transaction>(res)).toMatchObject({ id: bobTransaction.id, note: null });
    expect(await balanceOf(bob, bobAccount.id)).toBe(100_000_00 - 4_590_000 - 50_000_00);
  });
});
