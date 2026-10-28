/**
 * Postgres returns `sum(bigint)` as `numeric` (a string). Converts it to a safe
 * integer in minor units; null (no rows) becomes 0.
 */
export function toSafeInteger(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new RangeError('Aggregate exceeds the safe integer range');
  }
  return number;
}
