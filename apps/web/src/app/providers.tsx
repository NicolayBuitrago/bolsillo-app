'use client';

import {
  ApiClientProvider,
  createApiClient,
  createQueryClient,
  QueryClientProvider,
} from '@bolsillo/api-client';
import { type ReactNode, useState } from 'react';

/** Same-origin base URL: next.config.ts rewrites /api/* to the API. */
const API_BASE_URL = '/api';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [apiClient] = useState(() => createApiClient(API_BASE_URL));
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
    </QueryClientProvider>
  );
}
