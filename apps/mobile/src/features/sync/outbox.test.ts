import { ApiError } from '@bolsillo/api-client';
import type { CreateTransactionInput } from '@bolsillo/core/schemas';
import { createMemoryOutboxStore, createOutbox, type OutboxStore } from './outbox';

const USER = 'user-a';

let counter = 0;
function payload(overrides: Partial<CreateTransactionInput> = {}): CreateTransactionInput {
  counter += 1;
  return {
    id: `00000000-0000-7000-8000-${String(counter).padStart(12, '0')}`,
    type: 'expense',
    accountId: 'account-1',
    amountMinor: 4_590_000,
    occurredAt: '2026-10-28T15:00:00.000Z',
    ...overrides,
  };
}

/**
 * Fake API with the idempotency rules of POST /v1/transactions: the same id
 * with the same data answers 200 and is stored only once.
 */
function createFakeApi() {
  const stored = new Map<string, CreateTransactionInput>();
  const state = {
    online: true,
    /** Store the request but lose the response (connection drops mid-flight). */
    dropNextResponse: false,
  };
  const send = jest.fn(async (input: CreateTransactionInput): Promise<unknown> => {
    if (!state.online) throw new TypeError('Network request failed');
    const existing = stored.get(input.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(input)) {
      throw new ApiError(409, 'CONFLICT', 'Ya existe un movimiento con ese id');
    }
    stored.set(input.id, input);
    if (state.dropNextResponse) {
      state.dropNextResponse = false;
      throw new TypeError('Network request failed');
    }
    return { ...input, status: existing ? 200 : 201 };
  });
  return { stored, state, send };
}

function setup(store: OutboxStore = createMemoryOutboxStore()) {
  const api = createFakeApi();
  let userId: string | null = USER;
  let clock = 0;
  const outbox = createOutbox({
    store,
    send: api.send,
    getUserId: () => userId,
    now: () => ++clock,
  });
  return {
    api,
    outbox,
    store,
    signOut: () => (userId = null),
    signIn: (id: string) => (userId = id),
  };
}

describe('outbox', () => {
  it('syncs a transaction created offline exactly once when the network returns', async () => {
    const { api, outbox } = setup();
    api.state.online = false;

    const entry = outbox.enqueue(payload());
    await expect(outbox.flush()).resolves.toEqual({ sent: 0, failed: 0, remaining: 1 });
    expect(api.stored.size).toBe(0);
    expect(outbox.getSnapshot()).toHaveLength(1);

    api.state.online = true;
    // Reconnect and app-foreground triggers can fire at the same time.
    const results = await Promise.all([outbox.flush(), outbox.flush(), outbox.flush()]);

    expect(results[0]).toEqual({ sent: 1, failed: 0, remaining: 0 });
    expect(api.stored.size).toBe(1);
    expect(api.stored.get(entry.id)).toEqual(entry.payload);
    expect(outbox.getSnapshot()).toEqual([]);
    // One failed attempt offline + one successful send.
    expect(api.send).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate when the response is lost after the API stored it', async () => {
    const { api, outbox } = setup();
    const entry = outbox.enqueue(payload());
    api.state.dropNextResponse = true;

    await expect(outbox.flush()).resolves.toMatchObject({ sent: 0, remaining: 1 });
    expect(api.stored.size).toBe(1);

    await expect(outbox.flush()).resolves.toMatchObject({ sent: 1, remaining: 0 });
    expect(api.stored.size).toBe(1);
    expect(api.stored.get(entry.id)).toEqual(entry.payload);
  });

  it('sends in creation order and stops at the first network error', async () => {
    const { api, outbox } = setup();
    const first = outbox.enqueue(payload({ amountMinor: 1 }));
    const second = outbox.enqueue(payload({ amountMinor: 2 }));
    const third = outbox.enqueue(payload({ amountMinor: 3 }));

    api.send.mockImplementationOnce(async (input) => input);
    api.send.mockImplementationOnce(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(outbox.flush()).resolves.toEqual({ sent: 1, failed: 0, remaining: 2 });
    expect(outbox.getSnapshot().map((entry) => entry.id)).toEqual([second.id, third.id]);

    await outbox.flush();
    expect(api.send.mock.calls.map(([input]) => input.id)).toEqual([
      first.id,
      second.id,
      second.id,
      third.id,
    ]);
  });

  it('marks permanent API rejections as failed and keeps going', async () => {
    const { api, outbox } = setup();
    const rejected = outbox.enqueue(payload());
    const next = outbox.enqueue(payload());
    api.send.mockImplementationOnce(async () => {
      throw new ApiError(422, 'BUSINESS_RULE', 'La cuenta está archivada');
    });

    await expect(outbox.flush()).resolves.toEqual({ sent: 1, failed: 1, remaining: 0 });
    expect(outbox.getSnapshot()).toEqual([
      expect.objectContaining({ id: rejected.id, status: 'failed', lastError: 'BUSINESS_RULE' }),
    ]);
    expect(api.stored.has(next.id)).toBe(true);

    // A failed entry is not resent until the user retries it.
    await outbox.flush();
    expect(api.send).toHaveBeenCalledTimes(2);
    outbox.retry(rejected.id);
    await outbox.flush();
    expect(api.stored.has(rejected.id)).toBe(true);
  });

  it('keeps entries pending on 401, 429 and 5xx', async () => {
    const { api, outbox } = setup();
    outbox.enqueue(payload());
    for (const error of [
      new ApiError(401, 'UNAUTHENTICATED', 'x'),
      new ApiError(429, 'RATE_LIMITED', 'x'),
      new ApiError(503, 'INTERNAL', 'x'),
    ]) {
      api.send.mockImplementationOnce(async () => {
        throw error;
      });
      await expect(outbox.flush()).resolves.toMatchObject({ remaining: 1, failed: 0 });
    }
    expect(outbox.getSnapshot()[0]).toMatchObject({ status: 'pending', attempts: 3 });
  });

  it("only sends the signed-in user's entries", async () => {
    const { api, outbox, signIn, signOut } = setup();
    const mine = outbox.enqueue(payload());
    signOut();
    await expect(outbox.flush()).resolves.toEqual({ sent: 0, failed: 0, remaining: 0 });
    expect(() => outbox.enqueue(payload())).toThrow();

    signIn('user-b');
    await outbox.flush();
    expect(api.send).not.toHaveBeenCalled();

    signIn(USER);
    await outbox.flush();
    expect(api.stored.has(mine.id)).toBe(true);
  });

  it('survives a restart: a new outbox over the same store resumes the queue', async () => {
    const store = createMemoryOutboxStore();
    const first = setup(store);
    first.api.state.online = false;
    const entry = first.outbox.enqueue(payload());
    await first.outbox.flush();

    const second = setup(store);
    await expect(second.outbox.flush()).resolves.toMatchObject({ sent: 1 });
    expect(second.api.stored.has(entry.id)).toBe(true);
  });

  it('sends entries queued while a flush is running', async () => {
    const { api, outbox } = setup();
    let release: () => void = () => undefined;
    api.send.mockImplementationOnce(
      (input) => new Promise((resolve) => (release = () => resolve(input))),
    );
    outbox.enqueue(payload());
    const firstFlush = outbox.flush();
    const late = outbox.enqueue(payload());
    const secondFlush = outbox.flush();
    release();
    await expect(Promise.all([firstFlush, secondFlush])).resolves.toEqual([
      { sent: 2, failed: 0, remaining: 0 },
      { sent: 2, failed: 0, remaining: 0 },
    ]);
    expect(api.stored.has(late.id)).toBe(true);
  });

  it('notifies subscribers on every change', async () => {
    const { outbox } = setup();
    const listener = jest.fn();
    const unsubscribe = outbox.subscribe(listener);
    const entry = outbox.enqueue(payload());
    await outbox.flush();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    outbox.enqueue(payload());
    outbox.discard(entry.id);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
