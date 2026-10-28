import { type CurrencyCode, DEFAULT_CURRENCY, isCurrencyCode } from './currencies';
import { AmountParseError, MoneyError } from './errors';
import { digitsToMinor } from './minor';

export interface ParsedAmount {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface ParseAmountOptions {
  /** Currency used when the text has only a `$` symbol or no currency at all. */
  defaultCurrency?: CurrencyCode;
}

const SPACES = /[\s  ]+/g;
const LEADING_CODE = /^([a-z]{3})(?=[\s$\d])/i;
const TRAILING_CODE = /(?<=[\s\d])([a-z]{3})$/i;
const NUMBER_CHARS = /^\d[\d.,]*$/;

/**
 * Parses amounts as they appear in Colombian bank texts:
 * `$45.900`, `$45.900,50`, `$45,900.50`, `COP 45900`, `45.900,00 COP`, `$ 1.234.567`.
 *
 * Separator rules:
 * - Both `.` and `,` present: the last one is the decimal separator.
 * - Only one kind, repeated: thousands separator.
 * - Only one kind, once: followed by exactly 3 digits it is a thousands separator;
 *   by 1–2 digits it is a decimal separator; anything else is invalid.
 *
 * Throws `AmountParseError` on invalid input. Use `tryParseAmount` to get `null` instead.
 */
export function parseAmount(input: string, options: ParseAmountOptions = {}): ParsedAmount {
  let text = input.replace(SPACES, ' ').trim();
  if (text === '') {
    throw new AmountParseError('EMPTY_INPUT', 'Amount is empty');
  }
  if (text.startsWith('-') || text.startsWith('−')) {
    throw new AmountParseError('NEGATIVE_AMOUNT', 'Amounts must be positive');
  }

  let code: string | undefined;
  const leading = LEADING_CODE.exec(text);
  const trailing = TRAILING_CODE.exec(text);
  if (leading?.[1] && trailing?.[1]) {
    throw new AmountParseError('INVALID_FORMAT', 'Currency code appears twice');
  }
  if (leading?.[1]) {
    code = leading[1];
    text = text.slice(code.length);
  } else if (trailing?.[1]) {
    code = trailing[1];
    text = text.slice(0, -code.length);
  }

  text = text.trim();
  if (text.startsWith('$')) {
    text = text.slice(1).trim();
  }

  const currency = resolveCurrency(code, options.defaultCurrency ?? DEFAULT_CURRENCY);

  if (!NUMBER_CHARS.test(text)) {
    throw new AmountParseError('INVALID_FORMAT', 'Amount has unexpected characters');
  }

  const { integer, fraction } = splitSeparators(text);
  try {
    return { amountMinor: digitsToMinor(false, integer, fraction, currency), currency };
  } catch (error) {
    if (error instanceof MoneyError) {
      throw new AmountParseError(error.code, error.message);
    }
    throw error;
  }
}

/** Same as `parseAmount` but returns `null` instead of throwing. For capture parsers. */
export function tryParseAmount(input: string, options?: ParseAmountOptions): ParsedAmount | null {
  try {
    return parseAmount(input, options);
  } catch (error) {
    if (error instanceof AmountParseError) {
      return null;
    }
    throw error;
  }
}

function resolveCurrency(code: string | undefined, fallback: CurrencyCode): CurrencyCode {
  if (code === undefined) {
    return fallback;
  }
  const upper = code.toUpperCase();
  if (!isCurrencyCode(upper)) {
    throw new AmountParseError('UNSUPPORTED_CURRENCY', `Unsupported currency: ${upper}`);
  }
  return upper;
}

function splitSeparators(text: string): { integer: string; fraction: string } {
  const decimalIndex = findDecimalIndex(text);
  if (decimalIndex === -1) {
    return { integer: removeThousandsSeparators(text), fraction: '' };
  }
  const fraction = text.slice(decimalIndex + 1);
  if (!/^\d+$/.test(fraction)) {
    throw new AmountParseError('INVALID_FORMAT', 'Invalid decimal part');
  }
  return { integer: removeThousandsSeparators(text.slice(0, decimalIndex)), fraction };
}

/** Index of the decimal separator, or -1 when there is none. */
function findDecimalIndex(text: string): number {
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  if (lastDot === -1 && lastComma === -1) {
    return -1;
  }
  if (lastDot !== -1 && lastComma !== -1) {
    return Math.max(lastDot, lastComma);
  }
  const index = Math.max(lastDot, lastComma);
  const isRepeated = text.indexOf(text.charAt(index)) !== index;
  if (isRepeated) {
    return -1;
  }
  const digitsAfter = text.length - index - 1;
  if (digitsAfter === 3) {
    return -1;
  }
  if (digitsAfter === 1 || digitsAfter === 2) {
    return index;
  }
  throw new AmountParseError('INVALID_FORMAT', 'Ambiguous separator');
}

function removeThousandsSeparators(integerPart: string): string {
  const separators = new Set(integerPart.replace(/\d/g, ''));
  if (separators.size === 0) {
    return integerPart;
  }
  if (separators.size > 1) {
    throw new AmountParseError('INVALID_FORMAT', 'Mixed thousands separators');
  }
  const [separator = ''] = separators;
  const [first = '', ...rest] = integerPart.split(separator);
  if (!/^\d{1,3}$/.test(first) || !rest.every((group) => /^\d{3}$/.test(group))) {
    throw new AmountParseError('INVALID_FORMAT', 'Invalid thousands grouping');
  }
  return [first, ...rest].join('');
}
