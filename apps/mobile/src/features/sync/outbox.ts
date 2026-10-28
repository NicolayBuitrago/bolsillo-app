import { ApiError } from '@bolsillo/api-client';
import type { CreateTransactionInput } from '@bolsillo/core/schemas';

export type OutboxStatus = 'pending' | 'failed';

/** A transaction created on the device that the API has not confirmed yet. */
export interface OutboxEntry {
  /** Same as `payload.id` (client UUID v7): resending it is idempotent on the API. */
  id: string;
  /** Owner of the entry; only their session may send it. */
  userId: string;
  payload: CreateTransactionInput;
  createdAt: number;
  attempts: number;
  status: OutboxStatus;
  /** Error code from the API for failed entries (never amounts or merchants). */
  lastError: string | null;
}

/** Persistence of the queue (SQLite on the device, memory in tests). */
export interface OutboxStore {
  add(entry: OutboxEntry): void;
  /** All entries, oldest first. */
  all(): OutboxEntry[];
  update(id: string, patch: Partial<Pick<OutboxEntry, 'attempts' | 'status' | 'lastError'>>): void;
  remove(id: string): void;
}

export interface FlushResult {
  sent: number;
  failed: number;
  /** Pending entries left because the network or the server failed. */
  remaining: number;
}

export interface OutboxOptions {
  store: OutboxStore;
  /** Sends one entry (`POST /v1/transactions`). Must throw on failure. */
  send: (payload: CreateTransactionInput) => Promise<unknown>;
  /** Current signed-in user, or null when signed out. */
  getUserId: () => string | null;
  now?: () => number;
}

/**
 * Client errors that will not change by retrying (e.g. a 409 because the same
 * id was stored with other data, or a 422 for an archived account). 401, 408
 * and 429 are temporary: the entry stays pending.
 */
function isPermanentFailure(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![401, 408, 429].includes(error.status)
  );
}

/**
 * Offline outbox for new transactions.
 *
 * - Entries are sent in creation order, one at a time.
 * - An entry is removed only after a 2xx. If the response is lost after the
 *   API stored the transaction, the retry gets 200 for the same id, so the
 *   transaction exists exactly once.
 * - Only one flush runs at a time; concurrent calls share it.
 * - A network or server error stops the flush to keep the order; the next
 *   trigger (reconnect, app foreground, new entry) resumes it.
 */
export function createOutbox({ store, send, getUserId, now = Date.now }: OutboxOptions) {
  const listeners = new Set<() => void>();
  let snapshot = store.all();
  let running: Promise<FlushResult> | null = null;
  let requestedAgain = false;

  const notify = () => {
    snapshot = store.all();
    for (const listener of listeners) listener();
  };

  const nextPending = (userId: string) =>
    store.all().find((entry) => entry.userId === userId && entry.status === 'pending');

  async function run(): Promise<FlushResult> {
    const result: FlushResult = { sent: 0, failed: 0, remaining: 0 };
    const userId = getUserId();
    if (!userId) return result;

    for (let entry = nextPending(userId); entry; entry = nextPending(userId)) {
      try {
        await send(entry.payload);
        store.remove(entry.id);
        result.sent += 1;
        notify();
      } catch (error) {
        if (isPermanentFailure(error)) {
          store.update(entry.id, {
            status: 'failed',
            attempts: entry.attempts + 1,
            lastError: error.code,
          });
          result.failed += 1;
          notify();
          continue;
        }
        store.update(entry.id, { attempts: entry.attempts + 1 });
        notify();
        break;
      }
    }
    result.remaining = store
      .all()
      .filter((entry) => entry.userId === userId && entry.status === 'pending').length;
    return result;
  }

  return {
    enqueue(payload: CreateTransactionInput): OutboxEntry {
      const userId = getUserId();
      if (!userId) throw new Error('Cannot queue a transaction without a session');
      const entry: OutboxEntry = {
        id: payload.id,
        userId,
        payload,
        createdAt: now(),
        attempts: 0,
        status: 'pending',
        lastError: null,
      };
      store.add(entry);
      notify();
      return entry;
    },

    /**
     * Sends pending entries. A call made while a flush is running is joined to
     * it and triggers one more pass, so entries queued meanwhile are not left
     * waiting for the next trigger.
     */
    flush(): Promise<FlushResult> {
      if (running) {
        requestedAgain = true;
        return running;
      }
      running = (async () => {
        const total = await run();
        while (requestedAgain) {
          requestedAgain = false;
          const next = await run();
          total.sent += next.sent;
          total.failed += next.failed;
          total.remaining = next.remaining;
        }
        return total;
      })().finally(() => {
        running = null;
      });
      return running;
    },

    /** Puts a failed entry back in the queue. */
    retry(id: string) {
      store.update(id, { status: 'pending', lastError: null });
      notify();
    },

    discard(id: string) {
      store.remove(id);
      notify();
    },

    /** Entries of the signed-in user (stable reference for `useSyncExternalStore`). */
    getSnapshot(): OutboxEntry[] {
      return snapshot;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;

/** In-memory store for tests and as a fallback. */
export function createMemoryOutboxStore(initial: OutboxEntry[] = []): OutboxStore {
  let entries = [...initial];
  return {
    add: (entry) => {
      if (!entries.some((existing) => existing.id === entry.id)) entries.push(entry);
    },
    all: () => [...entries].sort((a, b) => a.createdAt - b.createdAt),
    update: (id, patch) => {
      entries = entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
    },
    remove: (id) => {
      entries = entries.filter((entry) => entry.id !== id);
    },
  };
}
