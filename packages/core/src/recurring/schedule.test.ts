import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, nextDueAfter, occurrence, occurrencesBetween } from './schedule';

describe('monthly payments anchored on the 31st', () => {
  it('use the last day of shorter months and return to the 31st', () => {
    const dates = [0, 1, 2, 3, 4].map((index) => occurrence('2026-10-31', 'monthly', index));
    expect(dates).toEqual(['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
    expect(occurrence('2027-01-31', 'monthly', 13)).toBe('2028-02-29');
    expect(occurrence('2027-01-31', 'monthly', 14)).toBe('2028-03-31');
  });

  it('advance from 30-day months and February without drifting', () => {
    expect(nextDueAfter('2026-10-31', 'monthly', '2026-11-30')).toBe('2026-12-31');
    expect(nextDueAfter('2026-10-31', 'monthly', '2027-02-28')).toBe('2027-03-31');
    expect(nextDueAfter('2026-10-31', 'monthly', '2027-03-31')).toBe('2027-04-30');
  });
});

describe('other frequencies', () => {
  it('handles weekly and biweekly payments', () => {
    expect(nextDueAfter('2026-10-01', 'weekly', '2026-10-01')).toBe('2026-10-08');
    expect(nextDueAfter('2026-10-01', 'weekly', '2026-10-09')).toBe('2026-10-15');
    expect(nextDueAfter('2026-10-01', 'biweekly', '2026-10-14')).toBe('2026-10-15');
    expect(occurrence('2026-12-25', 'biweekly', 1)).toBe('2027-01-08');
  });

  it('moves yearly payments on Feb 29 to Feb 28 in common years', () => {
    expect(occurrence('2028-02-29', 'yearly', 1)).toBe('2029-02-28');
    expect(occurrence('2028-02-29', 'yearly', 4)).toBe('2032-02-29');
    expect(nextDueAfter('2028-02-29', 'yearly', '2029-02-28')).toBe('2030-02-28');
  });

  it('returns the anchor when the date is before it', () => {
    expect(nextDueAfter('2026-12-01', 'monthly', '2026-10-28')).toBe('2026-12-01');
  });
});

describe('occurrencesBetween', () => {
  it('lists due dates in an inclusive window', () => {
    expect(occurrencesBetween('2026-10-31', 'monthly', '2026-11-01', '2027-03-01')).toEqual([
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
      '2027-02-28',
    ]);
    expect(occurrencesBetween('2026-10-01', 'weekly', '2026-10-08', '2026-10-22')).toEqual([
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
    ]);
    expect(occurrencesBetween('2026-10-01', 'weekly', '2026-10-01', '2027-10-01', 3)).toHaveLength(
      3,
    );
    expect(occurrencesBetween('2026-12-01', 'monthly', '2026-10-01', '2026-11-30')).toEqual([]);
  });
});

describe('date key helpers', () => {
  it('adds days and counts the difference', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-28', '2026-10-30')).toBe(2);
    expect(daysBetween('2026-10-30', '2026-10-28')).toBe(-2);
  });

  it('rejects invalid keys', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
    expect(() => occurrence('31/10/2026', 'monthly', 1)).toThrow(RangeError);
  });
});
