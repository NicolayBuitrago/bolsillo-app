import type {
  Account,
  CategoryTreeNode,
  MonthlyReport,
  Page,
  Settings,
  Transaction,
  Transfer,
} from '@bolsillo/core/schemas';
import { QueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createApiClient } from './client';
import { ApiError } from './errors';
import * as api from './fetchers';
import { invalidateMoney } from './hooks';
import { queryKeys } from './keys';

type Call = [input: RequestInfo | URL, init?: RequestInit];

function fakeFetch(status: number, body: unknown = {}) {
  return vi.fn(async (..._args: Call) =>
    status === 204 ? new Response(null, { status }) : Response.json(body, { status }),
  );
}

function lastRequest(fetch: ReturnType<typeof fakeFetch>) {
  const [input, init] = fetch.mock.calls.at(-1) ?? [];
  return { url: new URL(String(input)), init };
}

describe('fetchers', () => {
  it('serializes list filters and paging into the query string', async () => {
    const fetch = fakeFetch(200, { items: [], nextCursor: null });
    const client = createApiClient('http://api.test', { fetch });
    await api.fetchTransactions(
      client,
      { from: '2026-10-01', q: 'éxito', type: 'expense' },
      { cursor: 'abc', limit: 20 },
    );
    const { url, init } = lastRequest(fetch);
    expect(url.pathname).toBe('/v1/transactions');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: '2026-10-01',
      q: 'éxito',
      type: 'expense',
      cursor: 'abc',
      limit: '20',
    });
    expect(init?.method).toBe('GET');
  });

  it('sends JSON bodies and path params', async () => {
    const fetch = fakeFetch(200, {});
    const client = createApiClient('http://api.test', { fetch });
    await api.updateTransaction(client, 'tx-1', { note: 'Almuerzo' });
    const { url, init } = lastRequest(fetch);
    expect(url.pathname).toBe('/v1/transactions/tx-1');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ note: 'Almuerzo' });

    await api.adjustAccountBalance(client, 'acc-1', { actualBalanceMinor: 100 });
    expect(lastRequest(fetch).url.pathname).toBe('/v1/accounts/acc-1/adjust-balance');
  });

  it('resolves 204 responses and throws ApiError on failures', async () => {
    const client = createApiClient('http://api.test', { fetch: fakeFetch(204) });
    await expect(api.deleteTransaction(client, 'tx-1')).resolves.toBeUndefined();

    const failing = createApiClient('http://api.test', {
      fetch: fakeFetch(409, { error: { code: 'CONFLICT', message: 'Ya existe' } }),
    });
    const error = await api
      .createTransaction(failing, {
        id: 'x',
        type: 'expense',
        accountId: 'a',
        amountMinor: 1,
        occurredAt: '2026-10-28T00:00:00Z',
      })
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'CONFLICT' });
  });

  it('supports per-request headers (mobile session cookie)', async () => {
    const fetch = fakeFetch(200, {});
    let cookie = 'session=one';
    const client = createApiClient('http://api.test', {
      fetch,
      headers: () => ({ Cookie: cookie }),
      init: { credentials: 'omit' },
    });
    await api.fetchSettings(client);
    cookie = 'session=two';
    await api.fetchSettings(client);
    const { init } = lastRequest(fetch);
    expect(new Headers(init?.headers).get('cookie')).toBe('session=two');
    expect(init?.credentials).toBe('omit');
  });
});

describe('invalidateMoney', () => {
  it('invalidates transactions, accounts and reports only', async () => {
    const queryClient = new QueryClient();
    for (const key of [
      queryKeys.transactions.list({}),
      queryKeys.accounts.list(false),
      queryKeys.reports.monthly('2026-10'),
      queryKeys.categories.tree(false),
    ]) {
      queryClient.setQueryData(key, {});
    }
    await invalidateMoney(queryClient);
    const invalidated = queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.isInvalidated)
      .map((query) => query.queryKey[0]);
    expect(invalidated.sort()).toEqual(['accounts', 'reports', 'transactions']);
  });
});

describe('response types', () => {
  it('match the shared schemas of @bolsillo/core', () => {
    const client = createApiClient('http://api.test');
    type V1 = typeof client.v1;
    expectTypeOf<InferResponseType<V1['settings']['$get'], 200>>().toEqualTypeOf<Settings>();
    expectTypeOf<InferResponseType<V1['accounts']['$get'], 200>>().toEqualTypeOf<Account[]>();
    expectTypeOf<InferResponseType<V1['categories']['$get'], 200>>().toEqualTypeOf<
      CategoryTreeNode[]
    >();
    expectTypeOf<InferResponseType<V1['transactions']['$get'], 200>>().toEqualTypeOf<
      Page<Transaction>
    >();
    expectTypeOf<
      InferResponseType<V1['transactions']['$post'], 201>
    >().toEqualTypeOf<Transaction>();
    expectTypeOf<InferResponseType<V1['transfers']['$post'], 201>>().toEqualTypeOf<Transfer>();
    expectTypeOf<
      InferResponseType<V1['reports']['monthly']['$get'], 200>
    >().toEqualTypeOf<MonthlyReport>();
  });
});
