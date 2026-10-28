import { describe, expect, it } from 'vitest';
import { AmountParseError, MoneyError } from './errors';
import { parseAmount, tryParseAmount } from './parse';

describe('parseAmount', () => {
  it.each([
    // Formats required by the phase 0 acceptance criteria.
    ['$45.900', 4590000],
    ['$45.900,50', 4590050],
    ['$45,900.50', 4590050],
    ['COP 45900', 4590000],
    ['$ 1.234.567', 123456700],
    ['45.900,00 COP', 4590000],
    // Edge cases.
    ['45900', 4590000],
    ['0', 0],
    ['$0,5', 50],
    ['1.234,5', 123450],
    ['1,234,567.89', 123456789],
    ['1.234.567,89', 123456789],
    ['$45,900', 4590000],
    ['cop 45.900', 4590000],
    ['COP$45.900', 4590000],
    ['$45.900 COP', 4590000],
    ['  $ 45.900  ', 4590000],
    ['45.900 COP', 4590000],
    ['0045', 4500],
  ])('parses %j as %i minor units of COP', (input, amountMinor) => {
    expect(parseAmount(input)).toEqual({ amountMinor, currency: 'COP' });
  });

  it('reads an explicit currency code', () => {
    expect(parseAmount('USD 12.50')).toEqual({ amountMinor: 1250, currency: 'USD' });
    expect(parseAmount('12,50 usd')).toEqual({ amountMinor: 1250, currency: 'USD' });
  });

  it('uses the default currency when only `$` is present', () => {
    expect(parseAmount('$12.50', { defaultCurrency: 'USD' })).toEqual({
      amountMinor: 1250,
      currency: 'USD',
    });
  });

  it.each([
    ['', 'EMPTY_INPUT'],
    ['   ', 'EMPTY_INPUT'],
    ['abc', 'INVALID_FORMAT'],
    ['$', 'INVALID_FORMAT'],
    ['45.900.5', 'INVALID_FORMAT'],
    ['45,9001', 'INVALID_FORMAT'],
    ['45.', 'INVALID_FORMAT'],
    ['.50', 'INVALID_FORMAT'],
    ['45.900,', 'INVALID_FORMAT'],
    ['1,2.30', 'INVALID_FORMAT'],
    ['1.2,3.4', 'INVALID_FORMAT'],
    ['1234.567,00', 'INVALID_FORMAT'],
    ['12 345', 'INVALID_FORMAT'],
    ['45900 $', 'INVALID_FORMAT'],
    ['COP 45.900 COP', 'INVALID_FORMAT'],
    ['$45.900,123', 'TOO_MANY_DECIMALS'],
    ['-$45.900', 'NEGATIVE_AMOUNT'],
    ['−45.900', 'NEGATIVE_AMOUNT'],
    ['EUR 10', 'UNSUPPORTED_CURRENCY'],
    ['10 XYZ', 'UNSUPPORTED_CURRENCY'],
    ['99.999.999.999.999.999', 'UNSAFE_INTEGER'],
  ])('rejects %j with %s', (input, code) => {
    let caught: unknown;
    try {
      parseAmount(input);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AmountParseError);
    expect(caught).toBeInstanceOf(MoneyError);
    expect(caught).toMatchObject({ code, name: 'AmountParseError' });
  });
});

describe('tryParseAmount', () => {
  it('returns the parsed amount or null', () => {
    expect(tryParseAmount('$45.900')).toEqual({ amountMinor: 4590000, currency: 'COP' });
    expect(tryParseAmount('not an amount')).toBeNull();
  });
});
