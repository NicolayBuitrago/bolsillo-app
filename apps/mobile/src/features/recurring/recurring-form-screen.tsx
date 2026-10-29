import {
  ApiError,
  useAccounts,
  useCategories,
  useCreateRecurring,
  useRecurringPayments,
  useSettings,
  useUpdateRecurring,
} from '@bolsillo/api-client';
import { flattenCategoryTree } from '@bolsillo/core/categories';
import { DEFAULT_TIME_ZONE, toDateKey } from '@bolsillo/core/dates';
import { toAmountInput, tryParseAmount } from '@bolsillo/core/money';
import { RECURRENCE_FREQUENCIES, type RecurrenceFrequency } from '@bolsillo/core/recurring';
import {
  createRecurringPaymentSchema,
  type RecurringPayment,
  updateRecurringPaymentSchema,
} from '@bolsillo/core/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { OptionSheet } from '@/components/option-sheet';
import { LoadingState } from '@/components/states';
import { Button, Chip, TextField } from '@/components/ui';
import { frequencyLabels, REMIND_OPTIONS } from './strings';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function RecurringFormScreen({ id }: { id?: string | undefined }) {
  const payments = useRecurringPayments();
  if (id && payments.isPending) return <LoadingState />;
  const payment = id ? payments.data?.find((candidate) => candidate.id === id) : undefined;
  return <RecurringForm key={payment?.id ?? 'new'} payment={payment} />;
}

function RecurringForm({ payment }: { payment: RecurringPayment | undefined }) {
  const router = useRouter();
  const accounts = useAccounts();
  const categories = useCategories();
  const settings = useSettings();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();
  const timezone = settings.data?.timezone ?? DEFAULT_TIME_ZONE;

  const [name, setName] = useState(payment?.name ?? '');
  const [amount, setAmount] = useState(
    payment?.amountMinor ? toAmountInput(payment.amountMinor, payment.currency) : '',
  );
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(payment?.frequency ?? 'monthly');
  const [dueOn, setDueOn] = useState(payment?.nextDueOn ?? toDateKey(new Date(), timezone));
  const [accountId, setAccountId] = useState<string | null>(payment?.accountId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(payment?.categoryId ?? null);
  const [remindDays, setRemindDays] = useState(payment?.remindDaysBefore ?? 2);
  const [autoCreate, setAutoCreate] = useState(payment?.autoCreate ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<'account' | 'category' | null>(null);

  const account = accounts.data?.find((candidate) => candidate.id === accountId);
  const options = flattenCategoryTree(categories.data ?? [], 'expense');
  const category = options.find((option) => option.id === categoryId);
  const hasAmount = amount.trim() !== '';

  const save = async () => {
    const next: Record<string, string> = {};
    if (name.trim() === '') next.name = 'Escribe un nombre';
    const currency =
      account?.currency ?? payment?.currency ?? settings.data?.defaultCurrency ?? 'COP';
    const amountMinor = hasAmount
      ? (tryParseAmount(amount, { defaultCurrency: currency })?.amountMinor ?? 0)
      : null;
    if (amountMinor !== null && amountMinor <= 0) next.amount = 'Escribe un monto válido';
    if (!DATE_KEY.test(dueOn)) next.dueOn = 'Escribe la fecha como AAAA-MM-DD';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const shared = {
      name,
      amountMinor,
      accountId,
      categoryId,
      remindDaysBefore: remindDays,
      autoCreate: amountMinor !== null && autoCreate,
    };
    try {
      if (payment) {
        await update.mutateAsync({
          id: payment.id,
          input: updateRecurringPaymentSchema.parse({
            ...shared,
            ...(frequency !== payment.frequency ? { frequency } : {}),
            ...(dueOn !== payment.nextDueOn ? { nextDueOn: dueOn } : {}),
          }),
        });
      } else {
        await create.mutateAsync(
          createRecurringPaymentSchema.parse({ ...shared, frequency, firstDueOn: dueOn }),
        );
      }
      router.back();
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof ApiError ? error.message : 'Revisa tu conexión.',
      );
    }
  };

  const toggleActive = async () => {
    if (!payment) return;
    try {
      await update.mutateAsync({ id: payment.id, input: { active: !payment.active } });
      router.back();
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof ApiError ? error.message : 'Revisa tu conexión.',
      );
    }
  };

  return (
    <ScrollView contentContainerClassName="gap-5 p-4 pb-12" keyboardShouldPersistTaps="handled">
      <TextField
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Ej. Arriendo, Netflix, Energía"
        maxLength={60}
        error={errors.name}
      />
      <TextField
        label="Monto (opcional)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        hint="Déjalo vacío si cambia cada vez (por ejemplo, servicios)."
        error={errors.amount}
      />
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Frecuencia</Text>
        <View className="flex-row flex-wrap gap-2">
          {RECURRENCE_FREQUENCIES.map((option) => (
            <Chip
              key={option}
              label={frequencyLabels[option]}
              selected={frequency === option}
              onPress={() => setFrequency(option)}
            />
          ))}
        </View>
      </View>
      <TextField
        label={payment ? 'Próximo vencimiento' : 'Primer vencimiento'}
        value={dueOn}
        onChangeText={setDueOn}
        placeholder="AAAA-MM-DD"
        keyboardType="numbers-and-punctuation"
        error={errors.dueOn}
      />
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={`Cuenta: ${account?.name ?? 'elegir al pagar'}`}
          onPress={() => setSheet('account')}
        />
        <Chip
          label={`Categoría: ${category?.label ?? 'ninguna'}`}
          onPress={() => setSheet('category')}
        />
      </View>
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Recordar días antes</Text>
        <View className="flex-row flex-wrap gap-2">
          {REMIND_OPTIONS.map((days) => (
            <Chip
              key={days}
              label={days === 0 ? 'El mismo día' : String(days)}
              selected={remindDays === days}
              onPress={() => setRemindDays(days)}
            />
          ))}
        </View>
      </View>
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 text-foreground">
          Crear el movimiento pendiente automáticamente el día del vencimiento
          {hasAmount ? '' : ' (requiere un monto fijo)'}
        </Text>
        <Switch
          accessibilityLabel="Crear automáticamente"
          value={hasAmount && autoCreate}
          disabled={!hasAmount}
          onValueChange={setAutoCreate}
        />
      </View>
      <Button label="Guardar" loading={create.isPending || update.isPending} onPress={save} />
      {payment ? (
        <Button
          label={payment.active ? 'Pausar pago' : 'Reanudar pago'}
          variant="ghost"
          onPress={toggleActive}
        />
      ) : null}

      <OptionSheet
        visible={sheet === 'account'}
        title="Cuenta"
        selected={accountId ?? ''}
        options={[
          { value: '', label: 'Elegir al pagar' },
          ...(accounts.data ?? []).map((option) => ({
            value: option.id,
            label: option.name,
            description: option.currency,
            icon: option.icon,
            color: option.color,
          })),
        ]}
        onSelect={(value) => setAccountId(value || null)}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'category'}
        title="Categoría"
        selected={categoryId ?? ''}
        options={[
          { value: '', label: 'Sin categoría' },
          ...options.map((option) => ({
            value: option.id,
            label: option.name,
            icon: option.icon,
            color: option.color,
            nested: option.parentId !== null,
          })),
        ]}
        onSelect={(value) => setCategoryId(value || null)}
        onClose={() => setSheet(null)}
      />
    </ScrollView>
  );
}
