import { describe, expect, it } from 'vitest';
import { endOfDayInZone, startOfDayInZone, toDateKey } from './day';
import { formatDayHeading, formatMonth, formatTime } from './format';

const utc = (iso: string) => new Date(iso);
/** ICU may use narrow/no-break spaces; compare with plain spaces. */
const plain = (text: string) => text.replace(/[  ]/g, ' ');

describe('day boundaries', () => {
  it('starts and ends days in Bogotá (UTC−5)', () => {
    expect(startOfDayInZone('2026-10-28')).toEqual(utc('2026-10-28T05:00:00Z'));
    expect(endOfDayInZone('2026-10-28')).toEqual(utc('2026-10-29T05:00:00Z'));
    expect(endOfDayInZone('2026-12-31', 'UTC')).toEqual(utc('2027-01-01T00:00:00Z'));
  });

  it('handles DST days (23 hours long)', () => {
    const start = startOfDayInZone('2026-03-08', 'America/New_York');
    const end = endOfDayInZone('2026-03-08', 'America/New_York');
    expect(end.getTime() - start.getTime()).toBe(23 * 3_600_000);
  });

  it('rejects invalid dates and zones', () => {
    expect(() => startOfDayInZone('2026-02-30')).toThrow(RangeError);
    expect(() => startOfDayInZone('28/10/2026')).toThrow(RangeError);
    expect(() => startOfDayInZone('2026-10-28', 'Mars/Base')).toThrow(RangeError);
  });

  it('gets the local date key of an instant', () => {
    expect(toDateKey(utc('2026-10-29T04:59:59Z'))).toBe('2026-10-28');
    expect(toDateKey(utc('2026-10-29T05:00:00Z'))).toBe('2026-10-29');
    expect(toDateKey(utc('2026-10-29T04:59:59Z'), 'UTC')).toBe('2026-10-29');
  });
});

describe('date formatting (es-CO)', () => {
  const now = utc('2026-10-28T20:00:00Z');

  it('uses Hoy and Ayer relative to the user zone', () => {
    expect(formatDayHeading(utc('2026-10-28T06:00:00Z'), { now })).toBe('Hoy');
    expect(formatDayHeading(utc('2026-10-28T04:00:00Z'), { now })).toBe('Ayer');
  });

  it('spells out other days, with the year only when different', () => {
    expect(formatDayHeading(utc('2026-10-20T15:00:00Z'), { now })).toBe('Martes, 20 de octubre');
    expect(formatDayHeading(utc('2025-03-02T15:00:00Z'), { now })).toBe(
      'Domingo, 2 de marzo de 2025',
    );
  });

  it('formats times and months', () => {
    expect(plain(formatTime(utc('2026-10-28T20:05:00Z')))).toBe('3:05 p. m.');
    expect(formatMonth(utc('2026-10-28T20:05:00Z'))).toBe('Octubre de 2026');
  });
});
