import {
  ApiError,
  useArchiveBudget,
  useBudgets,
  useCategories,
  useCreateBudget,
  useUpdateBudget,
} from '@bolsillo/api-client';
import { flattenCategoryTree } from '@bolsillo/core/categories';
import { toAmountInput, tryParseAmount } from '@bolsillo/core/money';
import type { Budget } from '@bolsillo/core/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { CategoryIcon } from '@/components/category-icon';
import { OptionSheet } from '@/components/option-sheet';
import { LoadingState } from '@/components/states';
import { Button, Chip, TextField } from '@/components/ui';

function showError(error: unknown) {
  Alert.alert(
    'No se pudo guardar',
    error instanceof ApiError ? error.message : 'Revisa tu conexión.',
  );
}

export function BudgetFormScreen({ id }: { id?: string | undefined }) {
  const budgets = useBudgets();
  if (id && budgets.isPending) return <LoadingState />;
  const budget = id ? budgets.data?.find((candidate) => candidate.id === id) : undefined;
  return <BudgetForm key={budget?.id ?? 'new'} budget={budget} />;
}

function BudgetForm({ budget }: { budget: Budget | undefined }) {
  const router = useRouter();
  const categories = useCategories();
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const archive = useArchiveBudget();
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? '');
  const [amount, setAmount] = useState(
    budget ? toAmountInput(budget.amountMinor, budget.currency) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const options = flattenCategoryTree(categories.data ?? [], 'expense').filter(
    (option) => !option.isSystem,
  );
  const category = options.find((option) => option.id === categoryId);

  const save = async () => {
    const parsed = tryParseAmount(amount, { defaultCurrency: budget?.currency ?? 'COP' });
    if (!parsed || parsed.amountMinor <= 0) {
      setError('Escribe un monto válido mayor que cero');
      return;
    }
    try {
      if (budget) {
        await update.mutateAsync({ id: budget.id, input: { amountMinor: parsed.amountMinor } });
      } else {
        await create.mutateAsync({ categoryId, amountMinor: parsed.amountMinor });
      }
      router.back();
    } catch (reason) {
      showError(reason);
    }
  };

  const confirmArchive = () => {
    if (!budget) return;
    Alert.alert(
      '¿Archivar este presupuesto?',
      'Deja de mostrarse desde ahora. Tus movimientos no cambian.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await archive.mutateAsync(budget.id);
              router.back();
            } catch (reason) {
              showError(reason);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
      <Text className="text-sm text-muted-foreground">
        Incluye las subcategorías. Empieza a contar desde el mes actual.
      </Text>
      {budget ? (
        <Text className="text-lg font-semibold text-foreground">{category?.label ?? ''}</Text>
      ) : (
        <Chip
          label={category?.label ?? 'Elige una categoría'}
          icon={
            category ? (
              <CategoryIcon icon={category.icon} color={category.color} size={22} />
            ) : undefined
          }
          selected={Boolean(category)}
          onPress={() => setSheet(true)}
        />
      )}
      <TextField
        label="Monto mensual"
        value={amount}
        onChangeText={(value) => {
          setAmount(value);
          setError(null);
        }}
        keyboardType="decimal-pad"
        autoFocus={Boolean(budget)}
        error={error}
      />
      <Button
        label="Guardar"
        loading={create.isPending || update.isPending}
        disabled={!budget && !categoryId}
        onPress={save}
      />
      {budget ? (
        <Button label="Archivar presupuesto" variant="ghost" onPress={confirmArchive} />
      ) : null}
      <OptionSheet
        visible={sheet}
        title="Categoría"
        selected={categoryId}
        options={options.map((option) => ({
          value: option.id,
          label: option.name,
          icon: option.icon,
          color: option.color,
          nested: option.parentId !== null,
        }))}
        onSelect={setCategoryId}
        onClose={() => setSheet(false)}
      />
    </ScrollView>
  );
}
