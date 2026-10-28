import { toDateKey } from './day';
import { assertValidDate, DEFAULT_TIME_ZONE } from './zone';

const LOCALE = 'es-CO';

export interface DateFormatOptions {
  timeZone?: string;
  /** Reference instant for "Hoy" / "Ayer" (defaults to now). */
  now?: Date;
}

/** Day heading for grouped lists: "Hoy", "Ayer" or "martes, 28 de octubre" (+ year if not current). */
export function formatDayHeading(instant: Date, options: DateFormatOptions = {}): string {
  assertValidDate(instant);
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const now = options.now ?? new Date();
  const key = toDateKey(instant, timeZone);
  if (key === toDateKey(now, timeZone)) return 'Hoy';
  if (key === toDateKey(new Date(now.getTime() - 86_400_000), timeZone)) return 'Ayer';
  const sameYear = key.slice(0, 4) === toDateKey(now, timeZone).slice(0, 4);
  const text = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(instant);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Short time, e.g. "3:05 p. m.". */
export function formatTime(
  instant: Date,
  options: Pick<DateFormatOptions, 'timeZone'> = {},
): string {
  assertValidDate(instant);
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: options.timeZone ?? DEFAULT_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}

/** Month title, e.g. "Octubre de 2026". */
export function formatMonth(
  instant: Date,
  options: Pick<DateFormatOptions, 'timeZone'> = {},
): string {
  assertValidDate(instant);
  const text = new Intl.DateTimeFormat(LOCALE, {
    timeZone: options.timeZone ?? DEFAULT_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  }).format(instant);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
