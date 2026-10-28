import { ApiError, useCreateTransfer } from '@bolsillo/api-client';
import { newId } from '@bolsillo/core/ids';
import { createTransferSchema } from '@bolsillo/core/schemas';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { OptionSheet } from '@/components/option-sheet';
import { EmptyState, LoadingState } from '@/components/states';
import { Button, Chip, TextField } from '@/components/ui';
import { AmountKeypad } from './amount-keypad';
import { formatKeypadDisplay, keypadAmountMinor, pressKey } from './keypad';
import { transactionStrings as t } from './strings';
import { useLookups } from './use-lookups';

/** Transfer between two own accounts. Needs the network (creates two linked rows). */
export function TransferScreen() {
  const router = useRouter();
  const lookups = useLookups();
  const create = useCreateTransfer();
  const [id] = useState(newId);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState<'from' | 'to' | null>(null);

  if (lookups.isPending) return <LoadingState />;
  const accounts = lookups.activeAccounts;
  if (accounts.length < 2) {
    return (
      <View className="p-4">
        <EmptyState title={t.needTwoAccounts} />
      </View>
    );
  }
  const from = accounts.find((account) => account.id === (fromId ?? accounts[0]?.id));
  const to = accounts.find((account) => account.id === (toId ?? accounts[1]?.id));
  const currency = from?.currency ?? 'COP';
  const amountMinor = keypadAmountMinor(text, currency);
  const sameAccount = from?.id === to?.id;

  const save = async () => {
    if (!from || !to) return;
    try {
      await create.mutateAsync(
        createTransferSchema.parse({
          id,
          fromAccountId: from.id,
          toAccountId: to.id,
          amountMinor,
          occurredAt: new Date().toISOString(),
          note,
        }),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof ApiError ? error.message : 'Revisa tu conexión.',
      );
    }
  };

  const options = accounts.map((account) => ({
    value: account.id,
    label: account.name,
    description: account.currency,
    icon: account.icon,
    color: account.color,
  }));

  return (
    <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-sm text-muted-foreground">{t.fromAccount}</Text>
        <Chip label={from?.name ?? '—'} onPress={() => setSheet('from')} />
        <Text className="text-sm text-muted-foreground">{t.toAccount}</Text>
        <Chip label={to?.name ?? '—'} onPress={() => setSheet('to')} />
      </View>
      {sameAccount ? <Text className="text-sm text-destructive">{t.sameAccount}</Text> : null}
      <Text
        accessibilityLabel={`${t.amount}: ${formatKeypadDisplay(text, currency)}`}
        className="py-4 text-center text-5xl font-bold text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatKeypadDisplay(text, currency)}
      </Text>
      <AmountKeypad onPress={(key) => setText((current) => pressKey(current, key, currency))} />
      <TextField label={t.note} value={note} onChangeText={setNote} maxLength={500} />
      <Button
        label={t.save}
        loading={create.isPending}
        disabled={amountMinor <= 0 || sameAccount}
        onPress={save}
      />
      <OptionSheet
        visible={sheet !== null}
        title={sheet === 'from' ? t.fromAccount : t.toAccount}
        selected={sheet === 'from' ? from?.id : to?.id}
        options={options}
        onSelect={(value) => (sheet === 'from' ? setFromId(value) : setToId(value))}
        onClose={() => setSheet(null)}
      />
    </ScrollView>
  );
}
