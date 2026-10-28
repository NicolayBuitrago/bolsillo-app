import { ApiError, useAccounts, useAdjustBalance } from '@bolsillo/api-client';
import { toAmountInput, tryParseAmount } from '@bolsillo/core/money';
import type { Account } from '@bolsillo/core/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { AmountText } from '@/components/amount-text';
import { LoadingState } from '@/components/states';
import { Button, TextField } from '@/components/ui';
import { accountStrings as t } from './strings';

export function AdjustBalanceScreen({ id }: { id: string }) {
  const accounts = useAccounts();
  const account = accounts.data?.find((candidate) => candidate.id === id);
  if (!account) return <LoadingState />;
  return <AdjustBalanceForm account={account} />;
}

function AdjustBalanceForm({ account }: { account: Account }) {
  const router = useRouter();
  const adjust = useAdjustBalance();
  const isCard = account.type === 'credit_card';
  // What the user types: the debt for cards, the balance otherwise.
  const shown = isCard ? -account.balanceMinor : account.balanceMinor;
  const [text, setText] = useState(shown >= 0 ? toAmountInput(shown, account.currency) : '');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const parsed = tryParseAmount(text, { defaultCurrency: account.currency });
    if (!parsed || parsed.currency !== account.currency) {
      setError(t.invalidAmount);
      return;
    }
    try {
      const result = await adjust.mutateAsync({
        id: account.id,
        input: { actualBalanceMinor: isCard ? -parsed.amountMinor : parsed.amountMinor },
      });
      if (!result.transaction) Alert.alert(t.adjustBalance, t.noDifference);
      router.back();
    } catch (reason) {
      Alert.alert(
        t.errorTitle,
        reason instanceof ApiError ? reason.message : 'Revisa tu conexión.',
      );
    }
  };

  return (
    <ScrollView contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
      <Text className="text-lg font-semibold text-foreground">{account.name}</Text>
      <View className="flex-row items-baseline gap-2">
        <Text className="text-muted-foreground">{t.calculated}:</Text>
        <AmountText amountMinor={account.balanceMinor} currency={account.currency} />
      </View>
      <TextField
        label={isCard ? t.actualDebt : t.actualBalance}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setError(null);
        }}
        keyboardType="decimal-pad"
        autoFocus
        hint={t.adjustHint}
        error={error}
      />
      <Button label={t.adjustBalance} loading={adjust.isPending} onPress={save} />
    </ScrollView>
  );
}
