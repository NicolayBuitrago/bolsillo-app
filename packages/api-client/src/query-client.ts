import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

const MAX_RETRIES = 2;

/** Client errors (4xx) are not retried: repeating the same request will not fix them. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

/** QueryClient shared by web and mobile so both behave the same. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
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
