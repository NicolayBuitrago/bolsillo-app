import { describe, expect, it } from 'vitest';
import { currencyCodeSchema, getExponent, isCurrencyCode } from './currencies';
import { MoneyError } from './errors';
import { formatAmount } from './format';
import { toAmountInput } from './input';
import { amountMinorSchema, fromMinor, positiveAmountMinorSchema, toMinor } from './minor';
import { parseAmount } from './parse';
import { addMoney, sumByCurrency, sumMinor } from './sum';

describe('currencies', () => {
  it('knows COP and USD exponents', () => {
    expect(getExponent('COP')).toBe(2);
    expect(getExponent('USD')).toBe(2);
  });

  it('validates currency codes', () => {
    expect(isCurrencyCode('COP')).toBe(true);
    expect(isCurrencyCode('EUR')).toBe(false);
    expect(isCurrencyCode('toString')).toBe(false);
    expect(currencyCodeSchema.safeParse('USD').success).toBe(true);
    expect(currencyCodeSchema.safeParse('cop').success).toBe(false);
  });
});

describe('schemas', () => {
  it('accept only safe integers', () => {
    expect(amountMinorSchema.safeParse(-100).success).toBe(true);
    expect(amountMinorSchema.safeParse(1.5).success).toBe(false);
    expect(amountMinorSchema.safeParse(2 ** 53).success).toBe(false);
    expect(positiveAmountMinorSchema.safeParse(1).success).toBe(true);
    expect(positiveAmountMinorSchema.safeParse(0).success).toBe(false);
  });
});

describe('toMinor / fromMinor', () => {
  it.each([
    ['45900', 4590000],
    ['45900.5', 4590050],
    ['45900.50', 4590050],
    ['-12.34', -1234],
    ['-0', 0],
    [' 7 ', 700],
  ])('toMinor(%j) = %i', (major, minor) => {
    expect(toMinor(major, 'COP')).toBe(minor);
  });

  it('accepts plain numbers without float noise', () => {
    expect(toMinor(45900, 'COP')).toBe(4590000);
    expect(toMinor(12.5, 'USD')).toBe(1250);
  });

  it.each([
    ['1,5', 'INVALID_FORMAT'],
    ['abc', 'INVALID_FORMAT'],
    ['1.234', 'TOO_MANY_DECIMALS'],
    [0.1 + 0.2, 'TOO_MANY_DECIMALS'],
    [1e21, 'INVALID_FORMAT'],
    [Number.NaN, 'INVALID_FORMAT'],
    ['99999999999999999', 'UNSAFE_INTEGER'],
  ])('toMinor(%j) throws %s', (major, code) => {
    expect(() => toMinor(major, 'COP')).toThrow(MoneyError);
    expect(() => toMinor(major, 'COP')).toThrow(expect.objectContaining({ code }));
  });

  it.each([
    [4590000, '45900.00'],
    [4590050, '45900.50'],
    [5, '0.05'],
    [0, '0.00'],
    [-1234, '-12.34'],
  ])('fromMinor(%i) = %j', (minor, major) => {
    expect(fromMinor(minor, 'COP')).toBe(major);
  });

  it('round-trips', () => {
    for (const minor of [0, 1, 99, 100, 123456789, -987654321]) {
      expect(toMinor(fromMinor(minor, 'USD'), 'USD')).toBe(minor);
    }
  });

  it('rejects unsafe integers in fromMinor', () => {
    expect(() => fromMinor(2 ** 53, 'COP')).toThrow(
      expect.objectContaining({ code: 'UNSAFE_INTEGER' }),
    );
  });
});

describe('formatAmount', () => {
  const nbsp = ' ';

  it('formats COP in es-CO hiding zero decimals', () => {
    expect(formatAmount(4590000, 'COP')).toBe(`$${nbsp}45.900`);
    expect(formatAmount(123456700, 'COP')).toBe(`$${nbsp}1.234.567`);
  });

  it('shows decimals for COP when they are not zero', () => {
    expect(formatAmount(4590050, 'COP')).toBe(`$${nbsp}45.900,50`);
  });

  it('always shows decimals for USD', () => {
    expect(formatAmount(1250, 'USD')).toBe(`US$${nbsp}12,50`);
    expect(formatAmount(1200, 'USD')).toBe(`US$${nbsp}12,00`);
  });

  it('formats negatives and explicit signs', () => {
    expect(formatAmount(-123456700, 'COP')).toBe(`-$${nbsp}1.234.567`);
    expect(formatAmount(4590000, 'COP', { signDisplay: 'exceptZero' })).toBe(`+$${nbsp}45.900`);
  });

  it('accepts another locale', () => {
    expect(formatAmount(1250, 'USD', { locale: 'en-US' })).toBe('$12.50');
  });

  it('rejects non-integers', () => {
    expect(() => formatAmount(1.5, 'COP')).toThrow(MoneyError);
  });
});

describe('sums', () => {
  it('sums minor amounts', () => {
    expect(sumMinor([])).toBe(0);
    expect(sumMinor([100, 250, -50])).toBe(300);
  });

  it('fails on overflow or non-integers', () => {
    expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1])).toThrow(
      expect.objectContaining({ code: 'UNSAFE_INTEGER' }),
    );
    expect(() => sumMinor([0.5])).toThrow(expect.objectContaining({ code: 'UNSAFE_INTEGER' }));
  });

  it('adds money of the same currency only', () => {
    expect(
      addMoney({ amountMinor: 100, currency: 'COP' }, { amountMinor: 50, currency: 'COP' }),
    ).toEqual({
      amountMinor: 150,
      currency: 'COP',
    });
    expect(() =>
      addMoney({ amountMinor: 100, currency: 'COP' }, { amountMinor: 50, currency: 'USD' }),
    ).toThrow(expect.objectContaining({ code: 'CURRENCY_MISMATCH' }));
  });

  it('groups totals by currency', () => {
    expect(
      sumByCurrency([
        { amountMinor: 100, currency: 'COP' },
        { amountMinor: 1250, currency: 'USD' },
        { amountMinor: 900, currency: 'COP' },
      ]),
    ).toEqual({ COP: 1000, USD: 1250 });
    expect(sumByCurrency([])).toEqual({});
  });
});

describe('toAmountInput', () => {
  it('produces text that parseAmount reads back', () => {
    for (const minor of [4_590_000, 4_590_050, 5, 100, 0]) {
      const text = toAmountInput(minor, 'COP');
      expect(parseAmount(text, { defaultCurrency: 'COP' }).amountMinor).toBe(minor);
    }
    expect(toAmountInput(4_590_000, 'COP')).toBe('45900');
    expect(toAmountInput(4_590_050, 'COP')).toBe('45900,50');
    expect(toAmountInput(-1_500, 'USD')).toBe('15');
  });
});
