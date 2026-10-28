import { type CurrencyCode, getExponent } from './currencies';
import { assertSafeInteger } from './minor';

export const DEFAULT_LOCALE = 'es-CO';

export interface FormatAmountOptions {
  locale?: string;
  /** `'exceptZero'` shows `+`/`-`, useful for income/expense lists. Default `'auto'`. */
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never';
}

/** Currencies that hide their minor units when they are zero (`$ 45.900`, not `$ 45.900,00`). */
const HIDE_ZERO_DECIMALS: ReadonlySet<CurrencyCode> = new Set(['COP']);

const formatters = new Map<string, Intl.NumberFormat>();

/** Formats an amount in minor units, e.g. `formatAmount(4590000, 'COP')` → `$ 45.900`. */
export function formatAmount(
  amountMinor: number,
  currency: CurrencyCode,
  options: FormatAmountOptions = {},
): string {
  assertSafeInteger(amountMinor);
  const exponent = getExponent(currency);
  const divisor = 10 ** exponent;
  const hideDecimals = HIDE_ZERO_DECIMALS.has(currency) && amountMinor % divisor === 0;
  const fractionDigits = hideDecimals ? 0 : exponent;

  const locale = options.locale ?? DEFAULT_LOCALE;
  const signDisplay = options.signDisplay ?? 'auto';
  const key = `${locale}|${currency}|${fractionDigits}|${signDisplay}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
      signDisplay,
    });
    formatters.set(key, formatter);
  }
  // Division is display-only; rounding to `fractionDigits` makes it exact for safe integers.
  return formatter.format(amountMinor / divisor);
}
