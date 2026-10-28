import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createApiClient } from './client';
import { ApiError } from './errors';
import { fetchHealth } from './health';
import { createQueryClient, shouldRetry } from './query-client';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status }),
  );
}

describe('createApiClient', () => {
  it('calls the API under the base URL and sends cookies', async () => {
    const fetch = fakeFetch(200, { status: 'ok', db: 'ok' });
    await fetchHealth(createApiClient('http://api.test', { fetch }));
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://api.test/health');
    expect(init?.credentials).toBe('include');
  });

  it('works with a relative base URL (web rewrites)', async () => {
    const fetch = fakeFetch(200, { status: 'ok', db: 'ok' });
    await fetchHealth(createApiClient('http://web.test/api', { fetch }));
    expect(String(fetch.mock.calls[0]?.[0])).toBe('http://web.test/api/health');
  });
});

describe('fetchHealth', () => {
  it('returns the ok body', async () => {
    const client = createApiClient('http://api.test', {
      fetch: fakeFetch(200, { status: 'ok', db: 'ok' }),
    });
    await expect(fetchHealth(client)).resolves.toEqual({ status: 'ok', db: 'ok' });
  });

  it('returns the degraded body on 503', async () => {
    const client = createApiClient('http://api.test', {
      fetch: fakeFetch(503, { status: 'degraded', db: 'error' }),
    });
    await expect(fetchHealth(client)).resolves.toEqual({ status: 'degraded', db: 'error' });
  });

  it('throws ApiError with the API error code', async () => {
    const client = createApiClient('http://api.test', {
      fetch: fakeFetch(429, { error: { code: 'RATE_LIMITED', message: 'Espera' } }),
    });
    await expect(fetchHealth(client)).rejects.toMatchObject({
      name: 'ApiError',
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Espera',
    });
  });

  it('throws a generic ApiError for non-JSON failures', async () => {
    const client = createApiClient('http://api.test', { fetch: fakeFetch(502, 'Bad Gateway') });
    await expect(fetchHealth(client)).rejects.toMatchObject({ status: 502, code: 'INTERNAL' });
  });
});

describe('query client', () => {
  it('does not retry client errors', () => {
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', 'x'))).toBe(false);
    expect(shouldRetry(0, new ApiError(500, 'INTERNAL', 'x'))).toBe(true);
    expect(shouldRetry(0, new TypeError('network'))).toBe(true);
    expect(shouldRetry(2, new TypeError('network'))).toBe(false);
  });

  it('reports 401 errors from queries and mutations', async () => {
    const onUnauthenticated = vi.fn();
    const queryClient = createQueryClient({ onUnauthenticated });
    const unauthenticated = new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión');
    await queryClient
      .fetchQuery({ queryKey: ['x'], queryFn: () => Promise.reject(unauthenticated) })
      .catch(() => undefined);
    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => Promise.reject(new TypeError('network')) })
      .execute(undefined)
      .catch(() => undefined);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('applies shared defaults', () => {
    const defaults = createQueryClient().getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.mutations?.retry).toBe(false);
  });
});

describe('types', () => {
  it('are inferred from the API routes', () => {
    const client = createApiClient('http://api.test');
    expectTypeOf(fetchHealth).returns.resolves.toEqualTypeOf<
      { status: 'ok'; db: 'ok' } | { status: 'degraded'; db: 'error' }
    >();
    // @ts-expect-error routes that the API does not define are type errors
    expect(client.notARoute).toBeDefined();
  });
});
