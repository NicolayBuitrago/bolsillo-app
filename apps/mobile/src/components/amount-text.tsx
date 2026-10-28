import { type CurrencyCode, formatAmount } from '@bolsillo/core/money';
import type { TransactionType } from '@bolsillo/core/schemas';
import { Text } from 'react-native';

const TYPE_LABEL: Record<TransactionType, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer_out: 'Transferencia enviada',
  transfer_in: 'Transferencia recibida',
};

const OUTGOING: ReadonlySet<TransactionType> = new Set(['expense', 'transfer_out']);

/**
 * Money in es-CO format. With a `type`, expenses and income differ by sign
 * and by the accessible label, not only by color.
 */
export function AmountText({
  amountMinor,
  currency,
  type,
  className = '',
}: {
  amountMinor: number;
  currency: CurrencyCode;
  type?: TransactionType | undefined;
  className?: string;
}) {
  if (!type) {
    return (
      <Text className={`text-foreground ${className}`} style={{ fontVariant: ['tabular-nums'] }}>
        {formatAmount(amountMinor, currency)}
      </Text>
    );
  }
  const outgoing = OUTGOING.has(type);
  const text = formatAmount(outgoing ? -amountMinor : amountMinor, currency, {
    signDisplay: 'exceptZero',
  });
  const color =
    type === 'expense'
      ? 'text-expense'
      : type === 'income'
        ? 'text-income'
        : 'text-muted-foreground';
  return (
    <Text
      accessibilityLabel={`${TYPE_LABEL[type]}: ${text}`}
      className={`${color} ${className}`}
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {text}
    </Text>
  );
}
