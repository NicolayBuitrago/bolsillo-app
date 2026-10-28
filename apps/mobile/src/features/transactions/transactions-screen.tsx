import { type TransactionFilters, useTransactions } from '@bolsillo/api-client';
import {
  formatDayHeading,
  formatMonth,
  formatTime,
  getMonthRange,
  shiftMonthKey,
  toDateKey,
  toMonthKey,
} from '@bolsillo/core/dates';
import type { Transaction } from '@bolsillo/core/schemas';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmountText } from '@/components/amount-text';
import { CategoryIcon } from '@/components/category-icon';
import { NewTransactionFab } from '@/components/fab';
import { OptionSheet } from '@/components/option-sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button, Chip } from '@/components/ui';
import type { OutboxEntry } from '@/features/sync/outbox';
import { useOutboxEntries } from '@/features/sync/outbox-provider';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { transactionStrings as t } from './strings';
import { useLookups } from './use-lookups';

type TypeFilter = 'all' | 'expense' | 'income' | 'pending';

interface Row {
  key: string;
  transaction: Transaction | null;
  queued: OutboxEntry | null;
}

export function TransactionsScreen() {
  const router = useRouter();
  const lookups = useLookups();
  const { timezone } = lookups;
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState<string | null>(() => toMonthKey(new Date(), timezone));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'account' | 'category' | null>(null);
  const q = useDebouncedValue(search.trim());

  const filters = useMemo<TransactionFilters>(() => {
    const result: TransactionFilters = {};
    if (month) {
      const { start, end } = getMonthRange(month, timezone);
      result.from = toDateKey(start, timezone);
      result.to = toDateKey(new Date(end.getTime() - 1), timezone);
    }
    if (typeFilter === 'expense' || typeFilter === 'income') result.type = typeFilter;
    if (typeFilter === 'pending') result.status = 'pending';
    if (accountId) result.accountId = accountId;
    if (categoryId) result.categoryId = categoryId;
    if (q) result.q = q;
    return result;
  }, [month, timezone, typeFilter, accountId, categoryId, q]);

  const transactions = useTransactions(filters);
  const queued = useOutboxEntries(lookups.userId);

  const sections = useMemo(() => {
    const items = transactions.data?.pages.flatMap((page) => page.items) ?? [];
    const known = new Set(items.map((item) => item.id));
    const result: { title: string; data: Row[] }[] = [];
    const unsynced = queued.filter((entry) => !known.has(entry.id));
    if (unsynced.length > 0) {
      result.push({
        title: t.unsynced,
        data: unsynced.map((entry) => ({ key: entry.id, transaction: null, queued: entry })),
      });
    }
    const days = new Map<string, Row[]>();
    for (const item of items) {
      const day = toDateKey(new Date(item.occurredAt), timezone);
      days.set(day, [...(days.get(day) ?? []), { key: item.id, transaction: item, queued: null }]);
    }
    for (const [day, rows] of days) {
      const first = rows[0]?.transaction;
      result.push({
        title: first ? formatDayHeading(new Date(first.occurredAt), { timeZone: timezone }) : day,
        data: rows,
      });
    }
    return result;
  }, [transactions.data, queued, timezone]);

  const filtered = Boolean(q) || typeFilter !== 'all' || accountId !== null || categoryId !== null;
  const account = accountId ? lookups.accountsById.get(accountId) : undefined;
  const category = categoryId ? lookups.categoriesById.get(categoryId) : undefined;

  return (
    <SafeAreaView edges={['top']} className="flex-1">
      <View className="gap-3 px-4 pt-2 pb-3">
        <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
          {t.listTitle}
        </Text>
        <View className="min-h-12 flex-row items-center gap-2 rounded-lg border border-input px-3">
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            accessibilityLabel={t.search}
            placeholder={t.search}
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            className="flex-1 text-base text-foreground"
          />
        </View>
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.previousMonth}
            disabled={!month}
            onPress={() => month && setMonth(shiftMonthKey(month, -1))}
            className="size-11 items-center justify-center"
          >
            <Ionicons name="chevron-back" size={22} color="#64748b" />
          </Pressable>
          <Chip
            label={
              month
                ? formatMonth(getMonthRange(month, timezone).start, { timeZone: timezone })
                : t.allTime
            }
            selected={month === null}
            onPress={() => setMonth(month ? null : toMonthKey(new Date(), timezone))}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.nextMonth}
            disabled={!month}
            onPress={() => month && setMonth(shiftMonthKey(month, 1))}
            className="size-11 items-center justify-center"
          >
            <Ionicons name="chevron-forward" size={22} color="#64748b" />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {(
            [
              ['all', t.all],
              ['expense', t.expense],
              ['income', t.income],
              ['pending', t.pendingOnly],
            ] as const
          ).map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              selected={typeFilter === value}
              onPress={() => setTypeFilter(value)}
            />
          ))}
          <Chip
            label={account?.name ?? t.allAccounts}
            selected={accountId !== null}
            onPress={() => setSheet('account')}
          />
          <Chip
            label={category?.label ?? t.allCategories}
            selected={categoryId !== null}
            onPress={() => setSheet('category')}
          />
        </ScrollView>
      </View>

      {transactions.isPending || lookups.isPending ? (
        <LoadingState />
      ) : transactions.isError && sections.length === 0 ? (
        <View className="p-4">
          <ErrorState onRetry={() => transactions.refetch()} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row) => row.key}
          contentContainerClassName="px-4 pb-28"
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={transactions.isRefetching}
              onRefresh={() => void transactions.refetch()}
            />
          }
          renderSectionHeader={({ section }) => (
            <Text className="pt-4 pb-1 text-sm font-semibold text-muted-foreground">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) =>
            item.transaction ? (
              <TransactionRow
                transaction={item.transaction}
                lookups={lookups}
                onPress={() => router.push(`/transaction/${item.transaction?.id}`)}
              />
            ) : item.queued ? (
              <QueuedRow entry={item.queued} lookups={lookups} />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title={t.emptyTitle}
              description={filtered ? t.emptyFiltered : t.emptyHint}
            />
          }
          ListFooterComponent={
            transactions.hasNextPage ? (
              <Button
                label={t.loadMore}
                variant="outline"
                loading={transactions.isFetchingNextPage}
                onPress={() => void transactions.fetchNextPage()}
                className="mt-4"
              />
            ) : undefined
          }
        />
      )}
      <NewTransactionFab />

      <OptionSheet
        visible={sheet === 'account'}
        title={t.account}
        selected={accountId ?? ''}
        options={[
          { value: '', label: t.allAccounts },
          ...lookups.accounts.map((option) => ({
            value: option.id,
            label: option.name,
            icon: option.icon,
            color: option.color,
          })),
        ]}
        onSelect={(value) => setAccountId(value || null)}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'category'}
        title={t.category}
        selected={categoryId ?? ''}
        options={[
          { value: '', label: t.allCategories },
          ...lookups.categoryOptions
            .filter((option) => option.archivedAt === null)
            .map((option) => ({
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
    </SafeAreaView>
  );
}

type Lookups = ReturnType<typeof useLookups>;

function TransactionRow({
  transaction,
  lookups,
  onPress,
}: {
  transaction: Transaction;
  lookups: Lookups;
  onPress: () => void;
}) {
  const category = transaction.categoryId
    ? lookups.categoriesById.get(transaction.categoryId)
    : undefined;
  const account = transaction.accountId
    ? lookups.accountsById.get(transaction.accountId)
    : undefined;
  const isTransfer = transaction.transferGroupId !== null;
  const title =
    transaction.merchant ??
    (isTransfer
      ? transaction.type === 'transfer_out'
        ? 'Transferencia enviada'
        : 'Transferencia recibida'
      : (category?.name ?? t.noCategory));
  const subtitle = [
    transaction.status === 'pending' ? 'Pendiente' : null,
    formatTime(new Date(transaction.occurredAt), { timeZone: lookups.timezone }),
    account?.name,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-16 flex-row items-center gap-3 border-b border-border py-2 active:opacity-70"
    >
      <CategoryIcon
        icon={isTransfer ? 'bank' : category?.icon}
        color={isTransfer ? null : category?.color}
      />
      <View className="flex-1">
        <Text numberOfLines={1} className="font-medium text-foreground">
          {title}
        </Text>
        <Text numberOfLines={1} className="text-xs text-muted-foreground">
          {subtitle}
        </Text>
      </View>
      <AmountText
        amountMinor={transaction.amountMinor}
        currency={transaction.currency}
        type={transaction.type}
        className="font-semibold"
      />
    </Pressable>
  );
}

function QueuedRow({ entry, lookups }: { entry: OutboxEntry; lookups: Lookups }) {
  const { payload } = entry;
  const category = payload.categoryId ? lookups.categoriesById.get(payload.categoryId) : undefined;
  const account = lookups.accountsById.get(payload.accountId);
  const failed = entry.status === 'failed';
  return (
    <View className="min-h-16 flex-row items-center gap-3 border-b border-border py-2">
      <CategoryIcon icon={category?.icon} color={category?.color} />
      <View className="flex-1">
        <Text numberOfLines={1} className="font-medium text-foreground">
          {payload.merchant || category?.name || t.noCategory}
        </Text>
        <Text
          numberOfLines={1}
          className={`text-xs ${failed ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {failed ? t.syncFailed : t.unsyncedHint}
        </Text>
      </View>
      <AmountText
        amountMinor={payload.amountMinor}
        currency={account?.currency ?? 'COP'}
        type={payload.type}
        className="font-semibold"
      />
    </View>
  );
}
