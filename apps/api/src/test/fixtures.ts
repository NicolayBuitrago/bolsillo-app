import { newId } from '@bolsillo/core/ids';
import type {
  Account,
  CategoryKind,
  CategoryTreeNode,
  CreateAccountInput,
  CreateTransactionInput,
  Transaction,
} from '@bolsillo/core/schemas';
import { expect } from 'vitest';
import { json, type TestUser } from './helpers';

export async function createAccount(
  user: TestUser,
  input: Partial<CreateAccountInput> = {},
): Promise<Account> {
  const res = await user.post('/v1/accounts', {
    name: `Cuenta ${newId().slice(-6)}`,
    type: 'bank',
    ...input,
  });
  expect(res.status).toBe(201);
  return json<Account>(res);
}

/** Id of a category (top-level or subcategory) by name and kind. */
export async function categoryId(
  user: TestUser,
  name: string,
  kind: CategoryKind = 'expense',
): Promise<string> {
  const tree = await json<CategoryTreeNode[]>(await user.get('/v1/categories'));
  for (const node of tree) {
    if (node.kind !== kind) continue;
    if (node.name === name) return node.id;
    const child = node.children.find((candidate) => candidate.name === name);
    if (child) return child.id;
  }
  throw new Error(`Category not found: ${name}`);
}

export function transactionInput(
  accountId: string,
  overrides: Partial<CreateTransactionInput> = {},
): CreateTransactionInput {
  return {
    id: newId(),
    type: 'expense',
    accountId,
    amountMinor: 4_590_000,
    occurredAt: '2026-10-15T17:00:00.000Z',
    ...overrides,
  };
}

export async function createTransaction(
  user: TestUser,
  accountId: string,
  overrides: Partial<CreateTransactionInput> = {},
): Promise<Transaction> {
  const res = await user.post('/v1/transactions', transactionInput(accountId, overrides));
  expect(res.status).toBe(201);
  return json<Transaction>(res);
}

export async function balanceOf(user: TestUser, accountId: string): Promise<number> {
  const accounts = await json<Account[]>(await user.get('/v1/accounts?includeArchived=true'));
  const account = accounts.find((candidate) => candidate.id === accountId);
  if (!account) throw new Error(`Account not found: ${accountId}`);
  return account.balanceMinor;
}

export async function errorCode(res: Response): Promise<string> {
  return (await json<{ error: { code: string } }>(res)).error.code;
}
