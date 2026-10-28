import { describe, expect, it } from 'vitest';
import {
  endOfMonthInZone,
  getMonthRange,
  monthKeySchema,
  startOfMonthInZone,
  toMonthKey,
} from './month';
import { DEFAULT_TIME_ZONE, isValidTimeZone, timeZoneSchema } from './zone';

const utc = (iso: string) => new Date(iso);

describe('time zones', () => {
  it('defaults to Bogotá', () => {
    expect(DEFAULT_TIME_ZONE).toBe('America/Bogota');
  });

  it('validates IANA names', () => {
    expect(isValidTimeZone('America/Bogota')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(timeZoneSchema.safeParse('UTC').success).toBe(true);
    expect(timeZoneSchema.safeParse('nope').success).toBe(false);
  });
});

describe('month boundaries in America/Bogota (UTC-5, no DST)', () => {
  it('starts the month at local midnight', () => {
    expect(startOfMonthInZone(utc('2026-10-15T12:00:00Z'))).toEqual(utc('2026-10-01T05:00:00Z'));
  });

  it('ends at the first instant of the next month', () => {
    expect(endOfMonthInZone(utc('2026-10-15T12:00:00Z'))).toEqual(utc('2026-11-01T05:00:00Z'));
  });

  it('assigns late-night UTC instants to the local month', () => {
    // 2026-11-01T03:00Z is still 31 October 22:00 in Bogotá.
    const instant = utc('2026-11-01T03:00:00Z');
    expect(toMonthKey(instant)).toBe('2026-10');
    expect(getMonthRange(instant)).toEqual({
      start: utc('2026-10-01T05:00:00Z'),
      end: utc('2026-11-01T05:00:00Z'),
    });
  });

  it('handles February and year boundaries', () => {
    expect(getMonthRange('2028-02')).toEqual({
      start: utc('2028-02-01T05:00:00Z'),
      end: utc('2028-03-01T05:00:00Z'),
    });
    expect(getMonthRange('2026-12')).toEqual({
      start: utc('2026-12-01T05:00:00Z'),
      end: utc('2027-01-01T05:00:00Z'),
    });
  });
});

describe('month boundaries in other zones', () => {
  it('respects DST changes (America/New_York, March 2026)', () => {
    expect(getMonthRange('2026-03', 'America/New_York')).toEqual({
      start: utc('2026-03-01T05:00:00Z'),
      end: utc('2026-04-01T04:00:00Z'),
    });
  });

  it('works in UTC', () => {
    expect(getMonthRange('2026-01', 'UTC')).toEqual({
      start: utc('2026-01-01T00:00:00Z'),
      end: utc('2026-02-01T00:00:00Z'),
    });
    expect(toMonthKey(utc('2026-01-31T23:59:59Z'), 'UTC')).toBe('2026-01');
  });
});

describe('validation', () => {
  it('validates month keys', () => {
    expect(monthKeySchema.safeParse('2026-10').success).toBe(true);
    expect(monthKeySchema.safeParse('2026-13').success).toBe(false);
    expect(monthKeySchema.safeParse('2026-1').success).toBe(false);
  });

  it('rejects invalid input', () => {
    expect(() => getMonthRange('2026-00')).toThrow(RangeError);
    expect(() => getMonthRange('2026-10', 'Mars/Olympus')).toThrow(RangeError);
    expect(() => startOfMonthInZone(new Date('invalid'))).toThrow(RangeError);
    expect(() => toMonthKey(new Date('invalid'))).toThrow(RangeError);
  });
});
