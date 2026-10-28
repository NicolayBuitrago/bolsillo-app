import { type CurrencyCode, formatAmount, getExponent, tryParseAmount } from '@bolsillo/core/money';

export type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '000'
  | ','
  | 'back';

/** Whole units allowed: 12 digits (up to $ 999.999.999.999). */
const MAX_INTEGER_DIGITS = 12;

/**
 * Applies a key press to the amount text (es-CO style: digits, optional `,`
 * and up to the currency's decimals). Invalid presses leave the text unchanged.
 */
export function pressKey(text: string, key: KeypadKey, currency: CurrencyCode = 'COP'): string {
  if (key === 'back') return text.slice(0, -1);
  const [integer = '', fraction] = text.split(',');
  if (key === ',') {
    if (fraction !== undefined || getExponent(currency) === 0) return text;
    return `${integer || '0'},`;
  }
  if (fraction !== undefined) {
    const next = `${fraction}${key}`;
    return next.length > getExponent(currency) ? text : `${integer},${next}`;
  }
  const digits = `${integer}${key}`.replace(/^0+(?=\d)/, '');
  if (digits.length > MAX_INTEGER_DIGITS) return text;
  return digits === '0' && key === '000' ? '0' : digits;
}

/** Amount in minor units for the text, or 0 when empty/invalid. */
export function keypadAmountMinor(text: string, currency: CurrencyCode = 'COP'): number {
  if (text === '') return 0;
  return tryParseAmount(text.replace(/,$/, ''), { defaultCurrency: currency })?.amountMinor ?? 0;
}

/** Display while typing: `$ 45.900` and, once `,` is pressed, the typed decimals (`$ 45.900,5`). */
export function formatKeypadDisplay(text: string, currency: CurrencyCode = 'COP'): string {
  const [integer = '', fraction] = text.split(',');
  const exponent = getExponent(currency);
  const whole = formatAmount(Number(integer || '0') * 10 ** exponent, currency);
  return fraction === undefined ? whole : `${whole},${fraction}`;
}
