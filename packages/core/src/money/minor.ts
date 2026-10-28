import { z } from 'zod';
import { type CurrencyCode, getExponent } from './currencies';
import { MoneyError } from './errors';

/** Integer amount in minor units (e.g. COP cents). May be negative for balances. */
export const amountMinorSchema = z.number().refine(Number.isSafeInteger, {
  message: 'Must be a safe integer in minor units',
});

/** Strictly positive amount in minor units, as stored on transactions. */
export const positiveAmountMinorSchema = amountMinorSchema.refine((value) => value > 0, {
  message: 'Must be greater than zero',
});

export function assertSafeInteger(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError('UNSAFE_INTEGER', 'Amount exceeds the safe integer range');
  }
  return value;
}

const CANONICAL_DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

/**
 * Converts a canonical decimal in major units (`"45900.5"`, `"-12"`, or an
 * integer number) to minor units. Uses string arithmetic; never floats.
 */
export function toMinor(major: string | number, currency: CurrencyCode): number {
  const text = typeof major === 'number' ? numberToPlainString(major) : major.trim();
  const match = CANONICAL_DECIMAL.exec(text);
  if (!match) {
    throw new MoneyError('INVALID_FORMAT', 'Expected a decimal like "1234.56"');
  }
  const [, sign, integer = '', fraction = ''] = match;
  return digitsToMinor(sign === '-', integer, fraction, currency);
}

/** Converts minor units to a canonical decimal string in major units (`"45900.50"`). */
export function fromMinor(amountMinor: number, currency: CurrencyCode): string {
  assertSafeInteger(amountMinor);
  const exponent = getExponent(currency);
  const sign = amountMinor < 0 ? '-' : '';
  const digits = Math.abs(amountMinor)
    .toString()
    .padStart(exponent + 1, '0');
  if (exponent === 0) {
    return `${sign}${digits}`;
  }
  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

/** Builds minor units from already-validated digit strings. */
export function digitsToMinor(
  negative: boolean,
  integer: string,
  fraction: string,
  currency: CurrencyCode,
): number {
  const exponent = getExponent(currency);
  if (fraction.length > exponent) {
    throw new MoneyError(
      'TOO_MANY_DECIMALS',
      `${currency} allows at most ${exponent} decimal digits`,
    );
  }
  const value = Number(`${integer}${fraction.padEnd(exponent, '0')}`);
  const signed = negative && value !== 0 ? -value : value;
  return assertSafeInteger(signed);
}

function numberToPlainString(value: number): string {
  const text = String(value);
  if (!Number.isFinite(value) || /e/i.test(text)) {
    throw new MoneyError('INVALID_FORMAT', 'Number cannot be represented as a plain decimal');
  }
  return text;
}
