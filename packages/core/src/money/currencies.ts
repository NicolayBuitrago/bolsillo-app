import { z } from 'zod';

/** ISO 4217 currencies supported by the app, with their minor-unit exponent. */
export const CURRENCIES = {
  COP: { code: 'COP', exponent: 2 },
  USD: { code: 'USD', exponent: 2 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const DEFAULT_CURRENCY: CurrencyCode = 'COP';

export const currencyCodeSchema = z.enum(
  Object.keys(CURRENCIES) as [CurrencyCode, ...CurrencyCode[]],
);

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value);
}

export function getExponent(currency: CurrencyCode): number {
  return CURRENCIES[currency].exponent;
}
