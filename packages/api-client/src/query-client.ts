import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

const MAX_RETRIES = 2;

/** Client errors (4xx) are not retried: repeating the same request will not fix them. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

export interface QueryClientOptions {
  /** Called when any query or mutation gets a 401 (missing or expired session). */
  onUnauthenticated?: () => void;
}

/** QueryClient shared by web and mobile so both behave the same. */
export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      options.onUnauthenticated?.();
    }
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
