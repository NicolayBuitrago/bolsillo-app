import { ApiError, useAccounts, usePayRecurring, useRecurringPayments } from '@bolsillo/api-client';
import { toAmountInput } from '@bolsillo/core/money';
import type { RecurringPayment } from '@bolsillo/core/schemas';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { LoadingState } from '@/components/states';
import { Button, Chip } from '@/components/ui';
import { AmountKeypad } from '@/features/transactions/amount-keypad';
import { formatKeypadDisplay, keypadAmountMinor, pressKey } from '@/features/transactions/keypad';

export function RecurringPayScreen({ id }: { id: string }) {
  const payments = useRecurringPayments();
  const payment = payments.data?.find((candidate) => candidate.id === id);
  if (!payment) return <LoadingState />;
  return <PayForm payment={payment} />;
}

/** Registers the payment of the next due date (confirms the auto-created one if it exists). */
function PayForm({ payment }: { payment: RecurringPayment }) {
  const router = useRouter();
  const accounts = useAccounts();
  const pay = usePayRecurring();
  const [text, setText] = useState(
    payment.amountMinor ? toAmountInput(payment.amountMinor, payment.currency) : '',
  );
  const [accountId, setAccountId] = useState<string | null>(payment.accountId);
  const options = (accounts.data ?? []).filter((account) => account.currency === payment.currency);
  const amountMinor = keypadAmountMinor(text, payment.currency);

  const save = async () => {
    if (!accountId) return;
    try {
      await pay.mutateAsync({ id: payment.id, input: { amountMinor, accountId } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert(
        'No se pudo registrar',
        error instanceof ApiError ? error.message : 'Revisa tu conexión.',
      );
    }
  };

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <Text className="text-lg font-semibold text-foreground">{payment.name}</Text>
      <Text className="text-sm text-muted-foreground">
        Vence el {payment.nextDueOn}. Se registra como gasto confirmado.
      </Text>
      <Text
        accessibilityLabel={`Monto: ${formatKeypadDisplay(text, payment.currency)}`}
        className="py-2 text-center text-4xl font-bold text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatKeypadDisplay(text, payment.currency)}
      </Text>
      <AmountKeypad
        onPress={(key) => setText((current) => pressKey(current, key, payment.currency))}
      />
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Cuenta</Text>
        <View className="flex-row flex-wrap gap-2">
          {options.map((account) => (
            <Chip
              key={account.id}
              label={account.name}
              selected={accountId === account.id}
              onPress={() => setAccountId(account.id)}
            />
          ))}
        </View>
      </View>
      <Button
        label="Registrar pago"
        loading={pay.isPending}
        disabled={amountMinor <= 0 || !accountId}
        onPress={save}
      />
    </ScrollView>
  );
}
