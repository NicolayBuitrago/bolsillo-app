import type {
  Account,
  AdjustBalanceInput,
  Category,
  CategoryTreeNode,
  CreateAccountInput,
  CreateCategoryInput,
  CreateTransactionInput,
  CreateTransferInput,
  MonthlyReport,
  Page,
  Settings,
  Transaction,
  Transfer,
  UpdateAccountInput,
  UpdateCategoryInput,
  UpdateSettingsInput,
  UpdateTransactionInput,
} from '@bolsillo/core/schemas';
import type { ApiClient } from './client';
import { toApiError } from './errors';
import type { TransactionFilters } from './keys';

/** Throws `ApiError` for non-2xx responses; otherwise parses the JSON body. */
async function ok<T>(promise: Promise<Response>): Promise<T> {
  const res = await promise;
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

async function noContent(promise: Promise<Response>): Promise<void> {
  const res = await promise;
  if (!res.ok) throw await toApiError(res);
}

/*
 * One function per endpoint. Request shapes are checked by `hc<AppType>`;
 * responses are typed with the shared schemas of `@bolsillo/core`.
 */

export const fetchSettings = (client: ApiClient) => ok<Settings>(client.v1.settings.$get());

export const updateSettings = (client: ApiClient, json: UpdateSettingsInput) =>
  ok<Settings>(client.v1.settings.$patch({ json }));

export const fetchAccounts = (client: ApiClient, includeArchived = false) =>
  ok<Account[]>(
    client.v1.accounts.$get({ query: includeArchived ? { includeArchived: 'true' } : {} }),
  );

export const createAccount = (client: ApiClient, json: CreateAccountInput) =>
  ok<Account>(client.v1.accounts.$post({ json }));

export const updateAccount = (client: ApiClient, id: string, json: UpdateAccountInput) =>
  ok<Account>(client.v1.accounts[':id'].$patch({ param: { id }, json }));

export const archiveAccount = (client: ApiClient, id: string) =>
  ok<Account>(client.v1.accounts[':id'].archive.$post({ param: { id } }));

export const adjustAccountBalance = (client: ApiClient, id: string, json: AdjustBalanceInput) =>
  ok<{ account: Account; transaction: Transaction | null }>(
    client.v1.accounts[':id']['adjust-balance'].$post({ param: { id }, json }),
  );

export const fetchCategories = (client: ApiClient, includeArchived = false) =>
  ok<CategoryTreeNode[]>(
    client.v1.categories.$get({ query: includeArchived ? { includeArchived: 'true' } : {} }),
  );

export const createCategory = (client: ApiClient, json: CreateCategoryInput) =>
  ok<Category>(client.v1.categories.$post({ json }));

export const updateCategory = (client: ApiClient, id: string, json: UpdateCategoryInput) =>
  ok<Category>(client.v1.categories[':id'].$patch({ param: { id }, json }));

export const archiveCategory = (client: ApiClient, id: string) =>
  ok<Category>(client.v1.categories[':id'].archive.$post({ param: { id } }));

export const fetchTransactions = (
  client: ApiClient,
  filters: TransactionFilters,
  page: { cursor?: string | undefined; limit?: number } = {},
) =>
  ok<Page<Transaction>>(
    client.v1.transactions.$get({
      query: {
        ...filters,
        ...(page.cursor ? { cursor: page.cursor } : {}),
        ...(page.limit ? { limit: String(page.limit) } : {}),
      },
    }),
  );

export const fetchTransaction = (client: ApiClient, id: string) =>
  ok<Transaction>(client.v1.transactions[':id'].$get({ param: { id } }));

/** Idempotent by `json.id`: safe to retry (the mobile outbox relies on it). */
export const createTransaction = (client: ApiClient, json: CreateTransactionInput) =>
  ok<Transaction>(client.v1.transactions.$post({ json }));

export const updateTransaction = (client: ApiClient, id: string, json: UpdateTransactionInput) =>
  ok<Transaction>(client.v1.transactions[':id'].$patch({ param: { id }, json }));

export const deleteTransaction = (client: ApiClient, id: string) =>
  noContent(client.v1.transactions[':id'].$delete({ param: { id } }));

export const createTransfer = (client: ApiClient, json: CreateTransferInput) =>
  ok<Transfer>(client.v1.transfers.$post({ json }));

export const fetchMonthlyReport = (client: ApiClient, month: string) =>
  ok<MonthlyReport>(client.v1.reports.monthly.$get({ query: { month } }));
