import {
  ApiError,
  useAccounts,
  useArchiveAccount,
  useCreateAccount,
  useSettings,
  useUpdateAccount,
} from '@bolsillo/api-client';
import type { IconKey } from '@bolsillo/core/categories';
import { CURRENCIES, type CurrencyCode, toAmountInput, tryParseAmount } from '@bolsillo/core/money';
import {
  ACCOUNT_TYPES,
  type Account,
  type AccountType,
  createAccountSchema,
  updateAccountSchema,
} from '@bolsillo/core/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { ColorPicker, IconPicker } from '@/components/pickers';
import { LoadingState } from '@/components/states';
import { Button, Chip, TextField } from '@/components/ui';
import { accountTypeLabels, accountStrings as t } from './strings';

const TYPE_ICONS: Record<AccountType, IconKey> = {
  bank: 'bank',
  credit_card: 'card',
  cash: 'cash',
  digital_wallet: 'wallet',
  savings: 'savings',
  other: 'other',
};

function parseOptionalAmount(text: string, currency: CurrencyCode): number | null {
  if (text.trim() === '') return 0;
  return tryParseAmount(text, { defaultCurrency: currency })?.amountMinor ?? null;
}

function showError(error: unknown) {
  Alert.alert(t.errorTitle, error instanceof ApiError ? error.message : 'Revisa tu conexión.');
}

export function AccountFormScreen({ id }: { id?: string | undefined }) {
  const accounts = useAccounts({ includeArchived: true });
  const settings = useSettings();
  if (id && accounts.isPending) return <LoadingState />;
  const account = id ? accounts.data?.find((candidate) => candidate.id === id) : undefined;
  return (
    <AccountForm
      key={account?.id ?? 'new'}
      account={account}
      defaultCurrency={settings.data?.defaultCurrency ?? 'COP'}
    />
  );
}

function AccountForm({
  account,
  defaultCurrency,
}: {
  account: Account | undefined;
  defaultCurrency: CurrencyCode;
}) {
  const router = useRouter();
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const archive = useArchiveAccount();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank');
  const [institution, setInstitution] = useState(account?.institution ?? '');
  const [last4, setLast4] = useState(account?.last4 ?? '');
  const [currency, setCurrency] = useState<CurrencyCode>(account?.currency ?? defaultCurrency);
  const initialText = account ? toAmountInput(account.initialBalanceMinor, account.currency) : '';
  const [initial, setInitial] = useState(initialText);
  const [limit, setLimit] = useState(
    account?.creditLimitMinor ? toAmountInput(account.creditLimitMinor, account.currency) : '',
  );
  const [color, setColor] = useState(account?.color ?? '#3b82f6');
  const [icon, setIcon] = useState<IconKey>((account?.icon as IconKey | null) ?? 'bank');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isCard = type === 'credit_card';
  const saving = create.isPending || update.isPending;

  const save = async () => {
    const next: Record<string, string> = {};
    if (name.trim() === '') next.name = t.invalidName;
    if (last4 !== '' && !/^\d{4}$/.test(last4)) next.last4 = t.invalidLast4;
    const initialMinor = parseOptionalAmount(initial, currency);
    const limitMinor = isCard ? parseOptionalAmount(limit, currency) : 0;
    if (initialMinor === null) next.initial = t.invalidAmount;
    if (limitMinor === null) next.limit = t.invalidAmount;
    setErrors(next);
    if (Object.keys(next).length > 0 || initialMinor === null || limitMinor === null) return;

    const payload = {
      name,
      type,
      institution,
      last4: last4 || null,
      // A card starts with a debt: stored as a negative balance. Unchanged on
      // edit unless the user touched it (the field shows it without sign).
      initialBalanceMinor:
        account && initial === initialText
          ? undefined
          : isCard
            ? -Math.abs(initialMinor)
            : initialMinor,
      creditLimitMinor: isCard && limitMinor > 0 ? limitMinor : null,
      color,
      icon,
    };
    try {
      if (account) {
        await update.mutateAsync({ id: account.id, input: updateAccountSchema.parse(payload) });
      } else {
        await create.mutateAsync(createAccountSchema.parse({ ...payload, currency }));
      }
      router.back();
    } catch (error) {
      showError(error);
    }
  };

  const confirmArchive = () => {
    if (!account) return;
    Alert.alert(t.archiveTitle, t.archiveMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.archive,
        style: 'destructive',
        onPress: async () => {
          try {
            await archive.mutateAsync(account.id);
            router.back();
          } catch (error) {
            showError(error);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerClassName="gap-5 p-4 pb-12" keyboardShouldPersistTaps="handled">
      <TextField
        label={t.name}
        value={name}
        onChangeText={setName}
        placeholder={t.namePlaceholder}
        error={errors.name}
      />
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">{t.type}</Text>
        <View className="flex-row flex-wrap gap-2">
          {ACCOUNT_TYPES.map((option) => (
            <Chip
              key={option}
              label={accountTypeLabels[option]}
              selected={type === option}
              onPress={() => {
                setType(option);
                if (!account) setIcon(TYPE_ICONS[option]);
              }}
            />
          ))}
        </View>
      </View>
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">{t.currency}</Text>
        <View className="flex-row gap-2">
          {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
            <Chip
              key={code}
              label={code}
              selected={currency === code}
              onPress={() => {
                if (!account) setCurrency(code);
              }}
            />
          ))}
        </View>
        {account ? <Text className="text-xs text-muted-foreground">{t.currencyLocked}</Text> : null}
      </View>
      <TextField label={t.institution} value={institution} onChangeText={setInstitution} />
      <TextField
        label={t.last4}
        value={last4}
        onChangeText={setLast4}
        keyboardType="number-pad"
        maxLength={4}
        error={errors.last4}
      />
      <TextField
        label={isCard ? t.initialDebt : t.initialBalance}
        value={initial}
        onChangeText={setInitial}
        keyboardType="decimal-pad"
        placeholder="0"
        error={errors.initial}
      />
      {isCard ? (
        <TextField
          label={t.creditLimit}
          value={limit}
          onChangeText={setLimit}
          keyboardType="decimal-pad"
          placeholder="0"
          error={errors.limit}
        />
      ) : null}
      <ColorPicker value={color} onChange={setColor} />
      <IconPicker value={icon} color={color} onChange={setIcon} />
      <Button label={t.save} loading={saving} onPress={save} />
      {account && account.archivedAt === null ? (
        <View className="gap-3">
          <Button
            label={t.adjustBalance}
            variant="outline"
            onPress={() => router.push({ pathname: '/adjust-balance', params: { id: account.id } })}
          />
          <Button label={t.archive} variant="ghost" onPress={confirmArchive} />
        </View>
      ) : null}
    </ScrollView>
  );
}
