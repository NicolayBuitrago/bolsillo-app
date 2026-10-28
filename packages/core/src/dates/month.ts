import { TZDate, tz } from '@date-fns/tz';
import { addMonths, startOfMonth } from 'date-fns';
import { z } from 'zod';
import { assertTimeZone, assertValidDate, DEFAULT_TIME_ZONE } from './zone';

/** Calendar month as `YYYY-MM`, used by reports and budgets (`?month=2026-10`). */
export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');

export type MonthKey = z.infer<typeof monthKeySchema>;

/** Half-open UTC range `[start, end)` covering a calendar month in a time zone. */
export interface MonthRange {
  start: Date;
  /** First instant of the next month (exclusive). */
  end: Date;
}

/** First instant of the month that contains `instant`, as seen in `timeZone`. */
export function startOfMonthInZone(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): Date {
  assertValidDate(instant);
  assertTimeZone(timeZone);
  return new Date(startOfMonth(instant, { in: tz(timeZone) }).getTime());
}

/** First instant of the following month (exclusive end of the month containing `instant`). */
export function endOfMonthInZone(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): Date {
  const start = startOfMonthInZone(instant, timeZone);
  return new Date(addMonths(start, 1, { in: tz(timeZone) }).getTime());
}

/** Month range for a `YYYY-MM` key or for the month containing an instant. */
export function getMonthRange(
  month: MonthKey | Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): MonthRange {
  assertTimeZone(timeZone);
  const anchor = typeof month === 'string' ? monthKeyToInstant(month, timeZone) : month;
  return {
    start: startOfMonthInZone(anchor, timeZone),
    end: endOfMonthInZone(anchor, timeZone),
  };
}

/** `YYYY-MM` of `instant` as seen in `timeZone`. */
export function toMonthKey(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): MonthKey {
  assertValidDate(instant);
  assertTimeZone(timeZone);
  const local = new TZDate(instant.getTime(), timeZone);
  const month = String(local.getMonth() + 1).padStart(2, '0');
  return `${local.getFullYear()}-${month}`;
}

function monthKeyToInstant(month: MonthKey, timeZone: string): Date {
  const parsed = monthKeySchema.safeParse(month);
  if (!parsed.success) {
    throw new RangeError(`Invalid month key: ${month}`);
  }
  const [year, monthNumber] = parsed.data.split('-').map(Number) as [number, number];
  return new Date(new TZDate(year, monthNumber - 1, 1, timeZone).getTime());
}

/** Moves a `YYYY-MM` key by `delta` months (negative goes back). */
export function shiftMonthKey(month: MonthKey, delta: number): MonthKey {
  const parsed = monthKeySchema.safeParse(month);
  if (!parsed.success || !Number.isInteger(delta)) {
    throw new RangeError(`Invalid month shift: ${month} ${delta}`);
  }
  const [year, monthNumber] = parsed.data.split('-').map(Number) as [number, number];
  const index = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = String((index % 12) + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}
