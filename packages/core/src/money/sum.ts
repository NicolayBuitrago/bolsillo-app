import type { CurrencyCode } from './currencies';
import { MoneyError } from './errors';
import { assertSafeInteger } from './minor';

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

/** Adds minor-unit integers, failing if any operand or the result is not a safe integer. */
export function sumMinor(amounts: readonly number[]): number {
  let total = 0;
  for (const amount of amounts) {
    total = assertSafeInteger(total + assertSafeInteger(amount));
  }
  return total;
}

/** Adds two amounts of the same currency. Never mixes currencies. */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new MoneyError('CURRENCY_MISMATCH', `Cannot add ${a.currency} and ${b.currency}`);
  }
  return { amountMinor: sumMinor([a.amountMinor, b.amountMinor]), currency: a.currency };
}

/** Totals a list of amounts grouped by currency. */
export function sumByCurrency(items: readonly Money[]): Partial<Record<CurrencyCode, number>> {
  const totals: Partial<Record<CurrencyCode, number>> = {};
  for (const item of items) {
    totals[item.currency] = sumMinor([totals[item.currency] ?? 0, item.amountMinor]);
  }
  return totals;
}
