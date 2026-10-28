/**
 * Partial update where `undefined` means "leave unchanged" (Drizzle skips
 * undefined values in `set`). Needed under `exactOptionalPropertyTypes`.
 */
export type Patch<T> = { [K in keyof T]?: T[K] | undefined };
