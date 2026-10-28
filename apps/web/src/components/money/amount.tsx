import { type CurrencyCode, formatAmount } from '@bolsillo/core/money';
import type { TransactionType } from '@bolsillo/core/schemas';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<TransactionType, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer_out: 'Transferencia enviada',
  transfer_in: 'Transferencia recibida',
};

const OUTGOING: ReadonlySet<TransactionType> = new Set(['expense', 'transfer_out']);

interface AmountProps {
  amountMinor: number;
  currency: CurrencyCode;
  /** Adds the sign and an accessible label for the movement type. */
  type?: TransactionType;
  className?: string;
}

/**
 * Money in es-CO format with tabular figures. Expenses and income differ by
 * sign and by an accessible label, not only by color.
 */
export function Amount({ amountMinor, currency, type, className }: AmountProps) {
  if (!type) {
    return (
      <span className={cn('tabular-nums', className)}>{formatAmount(amountMinor, currency)}</span>
    );
  }
  const outgoing = OUTGOING.has(type);
  const text = formatAmount(outgoing ? -amountMinor : amountMinor, currency, {
    signDisplay: 'exceptZero',
  });
  return (
    <span
      className={cn(
        'tabular-nums',
        type === 'expense' && 'text-expense',
        type === 'income' && 'text-income',
        type.startsWith('transfer') && 'text-muted-foreground',
        className,
      )}
    >
      <span className="sr-only">{TYPE_LABEL[type]}: </span>
      {text}
    </span>
  );
}
