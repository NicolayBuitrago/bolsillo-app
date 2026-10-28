import { api, invalidateMoney, useApiClient, useQueryClient } from '@bolsillo/api-client';
import type { CreateTransactionInput } from '@bolsillo/core/schemas';
import * as Network from 'expo-network';
import { openDatabaseSync } from 'expo-sqlite';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';
import { createOutbox, type Outbox, type OutboxEntry } from './outbox';
import { createSqliteOutboxStore } from './sqlite-outbox-store';

const OutboxContext = createContext<Outbox | null>(null);

/**
 * Owns the device outbox and flushes it when the app starts, when the
 * network comes back and when the app returns to the foreground.
 */
export function OutboxProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const [outbox] = useState(() =>
    createOutbox({
      store: createSqliteOutboxStore(openDatabaseSync('bolsillo.db')),
      send: (payload) => api.createTransaction(client, payload),
      getUserId: () => userIdRef.current,
    }),
  );

  useEffect(() => {
    if (!userId) return;
    const flush = async () => {
      const result = await outbox.flush();
      if (result.sent > 0 || result.failed > 0) await invalidateMoney(queryClient);
    };
    void flush();
    const network = Network.addNetworkStateListener((state) => {
      if (state.isConnected) void flush();
    });
    const appState = AppState.addEventListener('change', (status) => {
      if (status === 'active') void flush();
    });
    return () => {
      network.remove();
      appState.remove();
    };
  }, [outbox, queryClient, userId]);

  return <OutboxContext.Provider value={outbox}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): Outbox {
  const outbox = useContext(OutboxContext);
  if (!outbox) throw new Error('useOutbox must be used inside <OutboxProvider>');
  return outbox;
}

/** Queued transactions of the signed-in user (pending and failed). */
export function useOutboxEntries(userId: string | null | undefined): OutboxEntry[] {
  const outbox = useOutbox();
  const entries = useSyncExternalStore(outbox.subscribe, outbox.getSnapshot);
  return userId ? entries.filter((entry) => entry.userId === userId) : [];
}

/**
 * Saves a new transaction through the outbox: it is stored on the device
 * first and sent right away when there is network.
 */
export function useQueueTransaction() {
  const outbox = useOutbox();
  const queryClient = useQueryClient();
  return async (payload: CreateTransactionInput) => {
    outbox.enqueue(payload);
    const result = await outbox.flush();
    if (result.sent > 0 || result.failed > 0) await invalidateMoney(queryClient);
    return { synced: !outbox.getSnapshot().some((entry) => entry.id === payload.id) };
  };
}
