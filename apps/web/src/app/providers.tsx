'use client';

import {
  ApiClientProvider,
  createApiClient,
  createQueryClient,
  QueryClientProvider,
} from '@bolsillo/api-client';
import { type ReactNode, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';

/** Same-origin base URL: next.config.ts rewrites /api/* to the API. */
const API_BASE_URL = '/api';

/** A 401 means the session cookie expired: go back to sign in. */
function redirectToSignIn() {
  const { pathname, search } = window.location;
  if (pathname.startsWith('/sign-in')) return;
  window.location.assign(`/sign-in?next=${encodeURIComponent(pathname + search)}`);
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient({ onUnauthenticated: redirectToSignIn }));
  const [apiClient] = useState(() => createApiClient(API_BASE_URL));
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        {children}
        <Toaster position="top-center" richColors />
      </ApiClientProvider>
    </QueryClientProvider>
  );
}
