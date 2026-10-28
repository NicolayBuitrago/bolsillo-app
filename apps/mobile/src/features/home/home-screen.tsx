import { useAccounts, useMonthlyReport, useSettings } from '@bolsillo/api-client';
import { formatMonth, getMonthRange, shiftMonthKey, toMonthKey } from '@bolsillo/core/dates';
import type { Account, MonthlyReport } from '@bolsillo/core/schemas';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmountText } from '@/components/amount-text';
import { CategoryIcon } from '@/components/category-icon';
import { NewTransactionFab } from '@/components/fab';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Card, SectionTitle } from '@/components/ui';
import { SyncBanner } from '@/features/sync/sync-banner';
import { authClient } from '@/lib/auth-client';
import { homeStrings as t } from './strings';

export function HomeScreen() {
  const settings = useSettings();
  const { data: session } = authClient.useSession();
  const timezone = settings.data?.timezone;
  const [month, setMonth] = useState<string | null>(null);
  const current = month ?? (timezone ? toMonthKey(new Date(), timezone) : null);
  const report = useMonthlyReport(current);
  const accounts = useAccounts();
  const refreshing = report.isRefetching || accounts.isRefetching;

  return (
    <SafeAreaView edges={['top']} className="flex-1">
      <ScrollView
        contentContainerClassName="gap-4 p-4 pb-28"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void report.refetch();
              void accounts.refetch();
            }}
          />
        }
      >
        <View className="flex-row items-center justify-between">
          <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
            {t.title}
          </Text>
          {current && timezone ? (
            <View className="flex-row items-center">
              <MonthButton
                icon="chevron-back"
                label={t.previousMonth}
                onPress={() => setMonth(shiftMonthKey(current, -1))}
              />
              <Text className="min-w-32 text-center font-medium text-foreground">
                {formatMonth(getMonthRange(current, timezone).start, { timeZone: timezone })}
              </Text>
              <MonthButton
                icon="chevron-forward"
                label={t.nextMonth}
                onPress={() => setMonth(shiftMonthKey(current, 1))}
              />
            </View>
          ) : null}
        </View>

        <SyncBanner userId={session?.user.id ?? null} />

        {!current || report.isPending ? (
          <LoadingState />
        ) : report.isError ? (
          <ErrorState onRetry={() => report.refetch()} />
        ) : (
          <>
            <Totals report={report.data} />
            <SpendingByCategory report={report.data} />
          </>
        )}

        <Card className="gap-2">
          <SectionTitle>{t.balances}</SectionTitle>
          {accounts.isPending ? (
            <LoadingState />
          ) : accounts.isError ? (
            <ErrorState onRetry={() => accounts.refetch()} />
          ) : accounts.data.length === 0 ? (
            <EmptyState title={t.noAccounts} description={t.noAccountsHint} />
          ) : (
            accounts.data.map((account) => <BalanceRow key={account.id} account={account} />)
          )}
        </Card>
      </ScrollView>
      <NewTransactionFab />
    </SafeAreaView>
  );
}

function MonthButton({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="size-11 items-center justify-center"
    >
      <Ionicons name={icon} size={22} color="#64748b" />
    </Pressable>
  );
}

function Totals({ report }: { report: MonthlyReport }) {
  const totals =
    report.totals.length > 0
      ? report.totals
      : [{ currency: 'COP' as const, incomeMinor: 0, expenseMinor: 0, netMinor: 0 }];
  return (
    <>
      {totals.map((row) => (
        <Card key={row.currency} className="gap-3">
          <View className="flex-row justify-between">
            <View className="gap-1">
              <Text className="text-sm text-muted-foreground">{t.income}</Text>
              <AmountText
                amountMinor={row.incomeMinor}
                currency={row.currency}
                type="income"
                className="text-xl font-semibold"
              />
            </View>
            <View className="items-end gap-1">
              <Text className="text-sm text-muted-foreground">{t.expenses}</Text>
              <AmountText
                amountMinor={row.expenseMinor}
                currency={row.currency}
                type="expense"
                className="text-xl font-semibold"
              />
            </View>
          </View>
          <View className="flex-row items-baseline justify-between border-t border-border pt-3">
            <Text className="text-sm text-muted-foreground">
              {t.net} ({row.currency})
            </Text>
            <AmountText
              amountMinor={row.netMinor}
              currency={row.currency}
              className="text-2xl font-bold"
            />
          </View>
        </Card>
      ))}
    </>
  );
}

function SpendingByCategory({ report }: { report: MonthlyReport }) {
  const expenses = report.byCategory.filter((row) => row.kind === 'expense');
  const totals = new Map<string, number>();
  for (const row of expenses)
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.totalMinor);
  return (
    <Card className="gap-3">
      <SectionTitle>{t.byCategory}</SectionTitle>
      {expenses.length === 0 ? (
        <Text className="text-sm text-muted-foreground">{t.byCategoryEmpty}</Text>
      ) : (
        expenses.map((row) => {
          const share = row.totalMinor / (totals.get(row.currency) ?? row.totalMinor);
          return (
            <View key={`${row.categoryId}-${row.currency}`} className="flex-row items-center gap-3">
              <CategoryIcon icon={row.icon} color={row.color} />
              <View className="flex-1 gap-1.5">
                <View className="flex-row justify-between gap-2">
                  <Text numberOfLines={1} className="flex-1 text-foreground">
                    {row.name ?? t.uncategorized}
                  </Text>
                  <AmountText amountMinor={row.totalMinor} currency={row.currency} />
                </View>
                <View className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(share * 100, 2)}%`,
                      backgroundColor: row.color ?? '#64748b',
                    }}
                  />
                </View>
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
}

function BalanceRow({ account }: { account: Account }) {
  const isCard = account.type === 'credit_card';
  return (
    <View className="min-h-14 flex-row items-center gap-3 py-1">
      <CategoryIcon icon={account.icon} color={account.color} />
      <Text numberOfLines={1} className="flex-1 font-medium text-foreground">
        {account.name}
      </Text>
      <View className="items-end">
        {isCard ? <Text className="text-xs text-muted-foreground">{t.debt}</Text> : null}
        <AmountText
          amountMinor={isCard ? Math.max(-account.balanceMinor, 0) : account.balanceMinor}
          currency={account.currency}
          className="font-semibold"
        />
      </View>
    </View>
  );
}
