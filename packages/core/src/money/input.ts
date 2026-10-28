import type { CurrencyCode } from './currencies';
import { fromMinor } from './minor';

/**
 * Editable text for an amount input, in es-CO style without thousands
 * separators: `4590000` COP → `"45900"`, `4590050` → `"45900,50"`.
 * `parseAmount` reads it back unchanged.
 */
export function toAmountInput(amountMinor: number, currency: CurrencyCode): string {
  const [integer, fraction = ''] = fromMinor(Math.abs(amountMinor), currency).split('.');
  return /^0*$/.test(fraction) ? `${integer}` : `${integer},${fraction}`;
}
