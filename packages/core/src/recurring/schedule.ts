import { z } from 'zod';

export const RECURRENCE_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'yearly'] as const;
export const recurrenceFrequencySchema = z.enum(RECURRENCE_FREQUENCIES);
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;

/*
 * Calendar arithmetic on `YYYY-MM-DD` keys. Due dates are calendar dates in
 * the user's time zone, so no time zone is involved here: dates are handled as
 * UTC midnights only to reuse Date's calendar math.
 */

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function parse(key: string): { year: number; month: number; day: number } {
  const match = DATE_KEY.exec(key);
  if (!match) throw new RangeError(`Invalid date key: ${key}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError(`Invalid date key: ${key}`);
  }
  return { year, month, day };
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(key: string, days: number): string {
  const { year, month, day } = parse(key);
  return format(new Date(Date.UTC(year, month - 1, day) + days * DAY_MS));
}

/** Days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS,
  );
}

/** Same day-of-month `months` later, clamped to the month's last day. */
function addMonthsClamped(anchor: string, months: number): string {
  const { year, month, day } = parse(anchor);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return format(new Date(Date.UTC(targetYear, targetMonth - 1, targetDay)));
}

/**
 * The `index`-th due date (0 = the anchor). Monthly and yearly payments keep
 * the anchor's day: a payment anchored on the 31st falls on the 30th in
 * 30-day months and on the 28th/29th in February, then back on the 31st.
 */
export function occurrence(anchor: string, frequency: RecurrenceFrequency, index: number): string {
  switch (frequency) {
    case 'weekly':
      return addDays(anchor, 7 * index);
    case 'biweekly':
      return addDays(anchor, 14 * index);
    case 'monthly':
      return addMonthsClamped(anchor, index);
    case 'yearly':
      return addMonthsClamped(anchor, 12 * index);
  }
}

/** Index of the first occurrence on or after `date` (never below 0). */
function firstIndexOnOrAfter(anchor: string, frequency: RecurrenceFrequency, date: string): number {
  if (date <= anchor) return 0;
  const a = parse(anchor);
  const d = parse(date);
  let estimate: number;
  if (frequency === 'weekly' || frequency === 'biweekly') {
    estimate = Math.floor(daysBetween(anchor, date) / (frequency === 'weekly' ? 7 : 14));
  } else {
    const months = d.year * 12 + d.month - (a.year * 12 + a.month);
    estimate = frequency === 'monthly' ? months : Math.floor(months / 12);
  }
  let index = Math.max(estimate - 1, 0);
  while (occurrence(anchor, frequency, index) < date) index += 1;
  return index;
}

/** First due date strictly after `date`. */
export function nextDueAfter(anchor: string, frequency: RecurrenceFrequency, date: string): string {
  return occurrence(anchor, frequency, firstIndexOnOrAfter(anchor, frequency, addDays(date, 1)));
}

/** Due dates in `[from, to]` (inclusive), oldest first. */
export function occurrencesBetween(
  anchor: string,
  frequency: RecurrenceFrequency,
  from: string,
  to: string,
  limit = 100,
): string[] {
  const result: string[] = [];
  for (
    let index = firstIndexOnOrAfter(anchor, frequency, from);
    result.length < limit;
    index += 1
  ) {
    const due = occurrence(anchor, frequency, index);
    if (due > to) break;
    result.push(due);
  }
  return result;
}
