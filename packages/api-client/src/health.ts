import { queryOptions, useQuery } from '@tanstack/react-query';
import type { ApiClient } from './client';
import { useApiClient } from './context';
import { toApiError } from './errors';

export type Health = { status: 'ok'; db: 'ok' } | { status: 'degraded'; db: 'error' };

/** `GET /health`. A 503 still carries a health body, so it is returned, not thrown. */
export async function fetchHealth(client: ApiClient): Promise<Health> {
  const res = await client.health.$get();
  if (res.status === 200 || res.status === 503) {
    return res.json();
  }
  throw await toApiError(res);
}

export function healthQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: ['health'] as const,
    queryFn: () => fetchHealth(client),
    refetchInterval: 30_000,
  });
}

export function useHealth() {
  return useQuery(healthQueryOptions(useApiClient()));
}
