import { TZDate } from '@date-fns/tz';
import { assertTimeZone, assertValidDate, DEFAULT_TIME_ZONE } from './zone';

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** First instant of a calendar date (`YYYY-MM-DD`) in `timeZone`. */
export function startOfDayInZone(date: string, timeZone: string = DEFAULT_TIME_ZONE): Date {
  assertTimeZone(timeZone);
  const match = DATE_KEY.exec(date);
  if (!match) {
    throw new RangeError(`Invalid date key: ${date}`);
  }
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const local = new TZDate(year, month - 1, day, timeZone);
  if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== day) {
    throw new RangeError(`Invalid date key: ${date}`);
  }
  return new Date(local.getTime());
}

/** First instant of the day after `date` (exclusive end of that day) in `timeZone`. */
export function endOfDayInZone(date: string, timeZone: string = DEFAULT_TIME_ZONE): Date {
  const start = startOfDayInZone(date, timeZone);
  const local = new TZDate(start.getTime(), timeZone);
  return new Date(
    new TZDate(local.getFullYear(), local.getMonth(), local.getDate() + 1, timeZone).getTime(),
  );
}

/** `YYYY-MM-DD` of `instant` as seen in `timeZone`. */
export function toDateKey(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  assertValidDate(instant);
  assertTimeZone(timeZone);
  const local = new TZDate(instant.getTime(), timeZone);
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${local.getFullYear()}-${month}-${day}`;
}
