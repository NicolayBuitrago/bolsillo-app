import { z } from 'zod';

export const DEFAULT_TIME_ZONE = 'America/Bogota';

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z.string().refine(isValidTimeZone, {
  message: 'Unknown IANA time zone',
});

export function assertTimeZone(timeZone: string): void {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Unknown time zone: ${timeZone}`);
  }
}

export function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Invalid date');
  }
}
