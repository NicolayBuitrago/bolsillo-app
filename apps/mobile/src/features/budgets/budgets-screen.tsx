import { useBudgetSummary } from '@bolsillo/api-client';
import type { BudgetSummaryItem } from '@bolsillo/core/schemas';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { AmountText } from '@/components/amount-text';
import { CategoryIcon } from '@/components/category-icon';
import { MonthSwitcher, useMonthState } from '@/components/month-switcher';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui';

/** Bar color: normal, warning from 80 %, destructive when overspent. */
function barColor(percent: number) {
  if (percent > 100) return 'bg-destructive';
  if (percent >= 80) return 'bg-warning';
  return 'bg-primary';
}

export function BudgetsScreen() {
  const router = useRouter();
  const { month, timezone, setMonth } = useMonthState();
  const summary = useBudgetSummary(month);

  return (
    <FlatList
      data={summary.data?.items ?? []}
      keyExtractor={(item) => item.budgetId}
      contentContainerClassName="gap-3 p-4 pb-12"
      refreshControl={
        <RefreshControl
          refreshing={summary.isRefetching}
          onRefresh={() => void summary.refetch()}
        />
      }
      ListHeaderComponent={
        <View className="gap-3">
          <MonthSwitcher month={month} timezone={timezone} onChange={setMonth} />
          <Button
            label="Nuevo presupuesto"
            variant="outline"
            onPress={() => router.push('/budget-form')}
          />
          {summary.isPending ? <LoadingState /> : null}
          {summary.isError ? <ErrorState onRetry={() => summary.refetch()} /> : null}
        </View>
      }
      ListEmptyComponent={
        summary.isSuccess ? (
          <EmptyState
            title="No hay presupuestos para este mes"
            description="Define cuánto quieres gastar al mes por categoría."
          />
        ) : undefined
      }
      renderItem={({ item }) => (
        <BudgetCard
          item={item}
          onPress={() => router.push({ pathname: '/budget-form', params: { id: item.budgetId } })}
        />
      )}
    />
  );
}

function BudgetCard({ item, onPress }: { item: BudgetSummaryItem; onPress: () => void }) {
  const over = item.remainingMinor < 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.categoryName}, ${item.percent} %`}
      onPress={onPress}
      className="gap-3 rounded-xl border border-border bg-card p-4 active:opacity-80"
    >
      <View className="flex-row items-center gap-3">
        <CategoryIcon icon={item.icon} color={item.color} />
        <Text className="flex-1 font-semibold text-foreground">{item.categoryName}</Text>
        <Text className="text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
          {item.percent} %
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-muted">
        <View
          className={`h-full rounded-full ${barColor(item.percent)}`}
          style={{ width: `${Math.min(item.percent, 100)}%` }}
        />
      </View>
      <View className="flex-row flex-wrap justify-between gap-1">
        <View className="flex-row items-baseline gap-1">
          <AmountText
            amountMinor={item.spentMinor}
            currency={item.currency}
            className="font-semibold"
          />
          <Text className="text-muted-foreground">de</Text>
          <AmountText amountMinor={item.amountMinor} currency={item.currency} />
        </View>
        <View className="flex-row items-baseline gap-1">
          <Text className={over ? 'text-destructive' : 'text-muted-foreground'}>
            {over ? 'Te pasaste por' : 'Quedan'}
          </Text>
          <AmountText
            amountMinor={Math.abs(item.remainingMinor)}
            currency={item.currency}
            className={over ? 'text-destructive' : ''}
          />
        </View>
      </View>
    </Pressable>
  );
}
