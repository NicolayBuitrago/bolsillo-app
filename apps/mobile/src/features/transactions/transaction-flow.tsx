import { type CategoryOption, flattenCategoryTree } from '@bolsillo/core/categories';
import { startOfDayInZone, toDateKey } from '@bolsillo/core/dates';
import { toAmountInput } from '@bolsillo/core/money';
import type { Account, CategoryTreeNode, EntryType } from '@bolsillo/core/schemas';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CategoryIcon } from '@/components/category-icon';
import { OptionSheet } from '@/components/option-sheet';
import { Button, Chip, Segmented, TextField } from '@/components/ui';
import { AmountKeypad } from './amount-keypad';
import { formatKeypadDisplay, type KeypadKey, keypadAmountMinor, pressKey } from './keypad';
import { transactionStrings as t } from './strings';

export interface TransactionDraft {
  type: EntryType;
  accountId: string;
  categoryId: string | null;
  amountMinor: number;
  /** ISO instant. */
  occurredAt: string;
  merchant: string;
  note: string;
}

type Step = 'amount' | 'category' | 'details';
type DayChoice = 'today' | 'yesterday' | 'other';

export interface TransactionFlowProps {
  accounts: Account[];
  categories: CategoryTreeNode[];
  timezone: string;
  /** Prefills the flow (editing) and starts at the details step. */
  initial?: TransactionDraft | undefined;
  /** Transfer rows only edit amount, date and note. */
  transfer?: boolean;
  defaultAccountId?: string | undefined;
  saving?: boolean;
  onSave: (draft: TransactionDraft) => void;
  /** Extra actions at the end of the details step (e.g. delete). */
  footer?: React.ReactNode;
  now?: () => Date;
}

/**
 * Manual entry in three taps after typing the amount:
 * "Siguiente" → category → "Guardar". The account comes preselected and the
 * date defaults to now; merchant, note and date are optional.
 */
export function TransactionFlow({
  accounts,
  categories,
  timezone,
  initial,
  transfer = false,
  defaultAccountId,
  saving = false,
  onSave,
  footer,
  now = () => new Date(),
}: TransactionFlowProps) {
  const [step, setStep] = useState<Step>(initial ? 'details' : 'amount');
  const [type, setType] = useState<EntryType>(initial?.type ?? 'expense');
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '',
  );
  const account = accounts.find((candidate) => candidate.id === accountId);
  const currency = account?.currency ?? 'COP';
  const [text, setText] = useState(initial ? toAmountInput(initial.amountMinor, currency) : '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [merchant, setMerchant] = useState(initial?.merchant ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [day, setDay] = useState<DayChoice>(initial ? 'other' : 'today');
  const [otherDay, setOtherDay] = useState(
    initial ? toDateKey(new Date(initial.occurredAt), timezone) : '',
  );
  const [dateError, setDateError] = useState<string | null>(null);
  const [accountSheet, setAccountSheet] = useState(false);

  const amountMinor = keypadAmountMinor(text, currency);
  const options = useMemo(() => flattenCategoryTree(categories, type), [categories, type]);
  const category = options.find((option) => option.id === categoryId);

  const onKey = (key: KeypadKey) => setText((current) => pressKey(current, key, currency));

  const resolveDate = (): string | null => {
    const current = now();
    if (day === 'today') return current.toISOString();
    const offsetDays = day === 'yesterday' ? 1 : null;
    if (offsetDays !== null) return new Date(current.getTime() - 86_400_000).toISOString();
    if (initial && otherDay === toDateKey(new Date(initial.occurredAt), timezone)) {
      return initial.occurredAt;
    }
    try {
      // Another day without a time: noon in the user's zone.
      return new Date(
        startOfDayInZone(otherDay, timezone).getTime() + 12 * 3_600_000,
      ).toISOString();
    } catch {
      return null;
    }
  };

  const save = () => {
    const occurredAt = resolveDate();
    if (!occurredAt) {
      setDateError(t.invalidDate);
      return;
    }
    onSave({ type, accountId, categoryId, amountMinor, occurredAt, merchant, note });
  };

  if (step === 'amount') {
    return (
      <View className="flex-1 justify-between gap-4 p-4">
        <View className="gap-4">
          {transfer ? null : (
            <Segmented
              options={[
                { value: 'expense', label: t.expense },
                { value: 'income', label: t.income },
              ]}
              value={type}
              onChange={(value) => {
                setType(value);
                setCategoryId(null);
              }}
            />
          )}
          <Text
            accessibilityLabel={`${t.amount}: ${formatKeypadDisplay(text, currency)}`}
            accessibilityLiveRegion="polite"
            className={`py-6 text-center text-5xl font-bold ${type === 'income' ? 'text-income' : 'text-foreground'}`}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatKeypadDisplay(text, currency)}
          </Text>
          {transfer ? null : (
            <View className="items-center">
              <Chip
                label={`${t.account}: ${account?.name ?? t.chooseAccount}`}
                onPress={() => setAccountSheet(true)}
              />
            </View>
          )}
        </View>
        <View className="gap-3">
          <AmountKeypad onPress={onKey} />
          <Button
            label={t.next}
            disabled={amountMinor <= 0}
            onPress={() => setStep(transfer || initial ? 'details' : 'category')}
          />
        </View>
        <OptionSheet
          visible={accountSheet}
          title={t.account}
          selected={accountId}
          options={accounts.map((option) => ({
            value: option.id,
            label: option.name,
            description: option.currency,
            icon: option.icon,
            color: option.color,
          }))}
          onSelect={setAccountId}
          onClose={() => setAccountSheet(false)}
        />
      </View>
    );
  }

  if (step === 'category') {
    return (
      <ScrollView contentContainerClassName="gap-3 p-4">
        <Text accessibilityRole="header" className="text-xl font-semibold text-foreground">
          {t.chooseCategory}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {options.map((option) => (
            <CategoryTile
              key={option.id}
              option={option}
              onPress={() => {
                setCategoryId(option.id);
                setStep('details');
              }}
            />
          ))}
          <CategoryTile
            option={null}
            onPress={() => {
              setCategoryId(null);
              setStep('details');
            }}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
      {transfer ? <Text className="text-sm text-muted-foreground">{t.transferHint}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.changeAmount}: ${formatKeypadDisplay(text, currency)}`}
        onPress={() => setStep('amount')}
        className="items-center py-2"
      >
        <Text className="text-sm text-muted-foreground">
          {type === 'income' ? t.income : t.expense}
        </Text>
        <Text
          className={`text-4xl font-bold ${type === 'income' ? 'text-income' : 'text-foreground'}`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatKeypadDisplay(text, currency)}
        </Text>
      </Pressable>

      {transfer ? null : (
        <View className="flex-row flex-wrap gap-2">
          <Chip
            label={category?.label ?? t.noCategory}
            icon={
              category ? (
                <CategoryIcon icon={category.icon} color={category.color} size={22} />
              ) : undefined
            }
            onPress={() => setStep('category')}
          />
          <Chip
            label={`${t.account}: ${account?.name ?? '—'}`}
            onPress={() => setAccountSheet(true)}
          />
        </View>
      )}

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">{t.date}</Text>
        <View className="flex-row gap-2">
          <Chip label={t.today} selected={day === 'today'} onPress={() => setDay('today')} />
          <Chip
            label={t.yesterday}
            selected={day === 'yesterday'}
            onPress={() => setDay('yesterday')}
          />
          <Chip label={t.otherDay} selected={day === 'other'} onPress={() => setDay('other')} />
        </View>
        {day === 'other' ? (
          <TextField
            label={t.date}
            value={otherDay}
            onChangeText={(value) => {
              setOtherDay(value);
              setDateError(null);
            }}
            placeholder={t.otherDayPlaceholder}
            keyboardType="numbers-and-punctuation"
            error={dateError}
          />
        ) : null}
      </View>

      {transfer ? null : (
        <TextField
          label={t.merchant}
          value={merchant}
          onChangeText={setMerchant}
          placeholder={t.merchantPlaceholder}
          maxLength={120}
        />
      )}
      <TextField label={t.note} value={note} onChangeText={setNote} maxLength={500} multiline />

      <Button
        label={saving ? t.saving : t.save}
        loading={saving}
        disabled={amountMinor <= 0 || !accountId}
        onPress={save}
      />
      {footer}

      <OptionSheet
        visible={accountSheet}
        title={t.account}
        selected={accountId}
        options={accounts.map((option) => ({
          value: option.id,
          label: option.name,
          description: option.currency,
          icon: option.icon,
          color: option.color,
        }))}
        onSelect={setAccountId}
        onClose={() => setAccountSheet(false)}
      />
    </ScrollView>
  );
}

function CategoryTile({ option, onPress }: { option: CategoryOption | null; onPress: () => void }) {
  const label = option?.name ?? t.noCategory;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={option?.parentName ? `${option.parentName}, ${label}` : label}
      onPress={onPress}
      className="min-h-24 w-[31%] items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-2"
    >
      <CategoryIcon icon={option?.icon ?? 'other'} color={option?.color} />
      <Text numberOfLines={2} className="text-center text-xs text-foreground">
        {label}
      </Text>
    </Pressable>
  );
}
