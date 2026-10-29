import { useMonthlyReport, useTrend } from '@bolsillo/api-client';
import { formatMonth, getMonthRange } from '@bolsillo/core/dates';
import { formatAmount } from '@bolsillo/core/money';
import type { MonthlyReport, TrendReport } from '@bolsillo/core/schemas';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { AmountText } from '@/components/amount-text';
import { CategoryIcon } from '@/components/category-icon';
import { MonthSwitcher, useMonthState } from '@/components/month-switcher';
import { ErrorState, LoadingState } from '@/components/states';
import { Card, SectionTitle, Segmented } from '@/components/ui';
import { reportStrings as t } from './strings';

export function ReportsScreen() {
  const { month, timezone, setMonth } = useMonthState();
  const report = useMonthlyReport(month);
  const [trendMonths, setTrendMonths] = useState<'6' | '12'>('6');
  const trend = useTrend(Number(trendMonths));

  return (
    <ScrollView
      contentContainerClassName="gap-4 p-4 pb-12"
      refreshControl={
        <RefreshControl
          refreshing={report.isRefetching || trend.isRefetching}
          onRefresh={() => {
            void report.refetch();
            void trend.refetch();
          }}
        />
      }
    >
      <MonthSwitcher month={month} timezone={timezone} onChange={setMonth} />
      {report.isPending ? (
        <LoadingState />
      ) : report.isError ? (
        <ErrorState onRetry={() => report.refetch()} />
      ) : (
        <Monthly report={report.data} />
      )}
      <Card className="gap-3">
        <SectionTitle>{t.trend}</SectionTitle>
        <Segmented
          options={[
            { value: '6', label: '6 meses' },
            { value: '12', label: '12 meses' },
          ]}
          value={trendMonths}
          onChange={setTrendMonths}
        />
        {trend.isPending || !timezone ? (
          <LoadingState />
        ) : trend.isError ? (
          <ErrorState onRetry={() => trend.refetch()} />
        ) : (
          <TrendBars trend={trend.data} timezone={timezone} />
        )}
      </Card>
    </ScrollView>
  );
}

function Monthly({ report }: { report: MonthlyReport }) {
  if (report.totals.length === 0) {
    return (
      <Card>
        <Text className="text-sm text-muted-foreground">
          Sin movimientos confirmados en este mes.
        </Text>
      </Card>
    );
  }
  return (
    <>
      {report.totals.map((row) => (
        <Card key={row.currency} className="gap-2">
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground">Ingresos</Text>
            <AmountText amountMinor={row.incomeMinor} currency={row.currency} type="income" />
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground">Gastos</Text>
            <AmountText amountMinor={row.expenseMinor} currency={row.currency} type="expense" />
          </View>
          <View className="flex-row justify-between border-t border-border pt-2">
            <Text className="font-semibold text-foreground">Neto ({row.currency})</Text>
            <AmountText amountMinor={row.netMinor} currency={row.currency} className="font-bold" />
          </View>
        </Card>
      ))}
      {(['expense', 'income'] as const).map((kind) => {
        const rows = report.byCategory.filter((row) => row.kind === kind);
        if (rows.length === 0) return null;
        return (
          <Card key={kind} className="gap-3">
            <SectionTitle>
              {kind === 'expense' ? 'Gastos por categoría' : 'Ingresos por categoría'}
            </SectionTitle>
            {rows.map((row) => (
              <View
                key={`${row.categoryId}-${row.currency}`}
                className="flex-row items-center gap-3"
              >
                <CategoryIcon icon={row.icon} color={row.color} size={30} />
                <Text numberOfLines={1} className="flex-1 text-foreground">
                  {row.name ?? 'Sin categoría'}
                </Text>
                <AmountText amountMinor={row.totalMinor} currency={row.currency} />
              </View>
            ))}
          </Card>
        );
      })}
      <Card className="gap-2">
        <SectionTitle>{t.byAccount}</SectionTitle>
        {report.byAccount.map((row) => (
          <View
            key={`${row.accountId}-${row.currency}`}
            className="gap-0.5 border-b border-border py-2"
          >
            <Text className="font-medium text-foreground">{row.name}</Text>
            <View className="flex-row justify-between">
              <AmountText amountMinor={row.incomeMinor} currency={row.currency} type="income" />
              <AmountText amountMinor={row.expenseMinor} currency={row.currency} type="expense" />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

/** Income/expense bars per month; each month also reads its totals for screen readers. */
function TrendBars({ trend, timezone }: { trend: TrendReport; timezone: string }) {
  const currency = trend.months.flatMap((item) => item.totals)[0]?.currency;
  if (!currency) {
    return (
      <Text className="text-sm text-muted-foreground">Aún no hay datos para la tendencia.</Text>
    );
  }
  const rows = trend.months.map((item) => {
    const total = item.totals.find((candidate) => candidate.currency === currency);
    const label = formatMonth(getMonthRange(item.month, timezone).start, { timeZone: timezone })
      .replace(/ de \d{4}$/, '')
      .slice(0, 3);
    return {
      month: item.month,
      label,
      income: total?.incomeMinor ?? 0,
      expense: total?.expenseMinor ?? 0,
    };
  });
  const max = Math.max(1, ...rows.flatMap((row) => [row.income, row.expense]));
  return (
    <View className="gap-3">
      <View className="h-40 flex-row items-end gap-1">
        {rows.map((row) => (
          <View
            key={row.month}
            accessible
            accessibilityLabel={`${row.label}: ingresos ${formatAmount(row.income, currency)}, gastos ${formatAmount(row.expense, currency)}`}
            className="flex-1 items-center gap-1"
          >
            <View className="h-32 w-full flex-row items-end justify-center gap-0.5">
              <View
                className="w-2/5 rounded-t bg-income"
                style={{ height: `${(row.income / max) * 100}%` }}
              />
              <View
                className="w-2/5 rounded-t bg-expense"
                style={{ height: `${(row.expense / max) * 100}%` }}
              />
            </View>
            <Text className="text-xs text-muted-foreground">{row.label}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row gap-4">
        <Text className="text-xs text-income">■ Ingresos</Text>
        <Text className="text-xs text-expense">■ Gastos</Text>
        <Text className="text-xs text-muted-foreground">({currency})</Text>
      </View>
    </View>
  );
}
