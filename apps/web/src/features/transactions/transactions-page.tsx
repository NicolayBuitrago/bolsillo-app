'use client';

import { type TransactionFilters, useTransactions } from '@bolsillo/api-client';
import { formatDayHeading, formatTime, toDateKey } from '@bolsillo/core/dates';
import {
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type Transaction,
  type TransactionStatus,
  type TransactionType,
} from '@bolsillo/core/schemas';
import { ArrowLeftRight, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CategoryIcon } from '@/components/category-icon';
import { Amount } from '@/components/money/amount';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  commonStrings,
  transactionStatusLabels,
  transactionTypeLabels,
} from '@/features/shared/strings';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { transactionStrings as t } from './strings';
import { useLookups } from './use-lookups';

interface FilterState {
  from: string;
  to: string;
  accountId: string;
  categoryId: string;
  type: TransactionType | '';
  status: TransactionStatus | '';
  q: string;
}

const EMPTY_FILTERS: FilterState = {
  from: '',
  to: '',
  accountId: '',
  categoryId: '',
  type: '',
  status: '',
  q: '',
};

/** Drops empty values so they are not sent as `?from=`. */
function toQuery(state: FilterState): TransactionFilters {
  const query: TransactionFilters = {};
  if (state.from) query.from = state.from;
  if (state.to) query.to = state.to;
  if (state.accountId) query.accountId = state.accountId;
  if (state.categoryId) query.categoryId = state.categoryId;
  if (state.type) query.type = state.type;
  if (state.status) query.status = state.status;
  if (state.q.trim()) query.q = state.q.trim();
  return query;
}

export function TransactionsPage() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  // Waits for the user to stop typing before querying.
  const deferredFilters = useDebouncedValue(filters);
  const query = useMemo(() => toQuery(deferredFilters), [deferredFilters]);
  const transactions = useTransactions(query);
  const lookups = useLookups();
  const filtered = Object.keys(toQuery(filters)).length > 0;

  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const items = useMemo(
    () => transactions.data?.pages.flatMap((page) => page.items) ?? [],
    [transactions.data],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.listTitle}</h1>
        <div className="flex gap-2">
          <Link href="/transfer" className={buttonVariants({ variant: 'outline' })}>
            <ArrowLeftRight data-icon="inline-start" />
            {t.newTransfer}
          </Link>
          <Link href="/transactions/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            {t.newTransaction}
          </Link>
        </div>
      </div>

      <section aria-label="Filtros" className="flex flex-col gap-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label={t.search}
            placeholder={t.search}
            className="pl-8"
            value={filters.q}
            onChange={(event) => set('q', event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <FilterField id="filter-from" label={t.from}>
            <Input
              id="filter-from"
              type="date"
              value={filters.from}
              onChange={(event) => set('from', event.target.value)}
            />
          </FilterField>
          <FilterField id="filter-to" label={t.to}>
            <Input
              id="filter-to"
              type="date"
              value={filters.to}
              onChange={(event) => set('to', event.target.value)}
            />
          </FilterField>
          <FilterField id="filter-account" label={t.account}>
            <NativeSelect
              id="filter-account"
              className="w-full"
              value={filters.accountId}
              onChange={(event) => set('accountId', event.target.value)}
            >
              <NativeSelectOption value="">{t.allAccounts}</NativeSelectOption>
              {lookups.accounts.map((account) => (
                <NativeSelectOption key={account.id} value={account.id}>
                  {account.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FilterField>
          <FilterField id="filter-category" label={t.category}>
            <NativeSelect
              id="filter-category"
              className="w-full"
              value={filters.categoryId}
              onChange={(event) => set('categoryId', event.target.value)}
            >
              <NativeSelectOption value="">{t.allCategories}</NativeSelectOption>
              {lookups.categoryOptions.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FilterField>
          <FilterField id="filter-type" label={t.type}>
            <NativeSelect
              id="filter-type"
              className="w-full"
              value={filters.type}
              onChange={(event) => set('type', event.target.value as FilterState['type'])}
            >
              <NativeSelectOption value="">{t.all}</NativeSelectOption>
              {TRANSACTION_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {transactionTypeLabels[type]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FilterField>
          <FilterField id="filter-status" label={t.status}>
            <NativeSelect
              id="filter-status"
              className="w-full"
              value={filters.status}
              onChange={(event) => set('status', event.target.value as FilterState['status'])}
            >
              <NativeSelectOption value="">{t.all}</NativeSelectOption>
              {TRANSACTION_STATUSES.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {transactionStatusLabels[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FilterField>
        </div>
        {filtered ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t.clearFilters}
            </Button>
          </div>
        ) : null}
      </section>

      {transactions.isPending || lookups.isPending ? (
        <LoadingState rows={6} />
      ) : transactions.isError ? (
        <ErrorState onRetry={() => transactions.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={filtered ? t.emptyFiltered : t.emptyHint}
          action={
            filtered ? null : (
              <Link href="/transactions/new" className={buttonVariants()}>
                {t.newTransaction}
              </Link>
            )
          }
        />
      ) : (
        <>
          <TransactionTable items={items} lookups={lookups} />
          {transactions.hasNextPage ? (
            <Button
              variant="outline"
              className="self-center"
              disabled={transactions.isFetchingNextPage}
              onClick={() => transactions.fetchNextPage()}
            >
              {commonStrings.loadMore}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function TransactionTable({
  items,
  lookups,
}: {
  items: Transaction[];
  lookups: ReturnType<typeof useLookups>;
}) {
  const router = useRouter();
  const { timezone } = lookups;
  const days = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const item of items) {
      const key = toDateKey(new Date(item.occurredAt), timezone);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()];
  }, [items, timezone]);

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden w-24 md:table-cell">{t.time}</TableHead>
            <TableHead>{t.description}</TableHead>
            <TableHead className="hidden md:table-cell">{t.category}</TableHead>
            <TableHead className="hidden lg:table-cell">{t.account}</TableHead>
            <TableHead className="text-right">{t.amount}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map(([day, dayItems]) => (
            <DayGroup
              key={day}
              heading={formatDayHeading(new Date(dayItems[0]?.occurredAt ?? day), {
                timeZone: timezone,
              })}
            >
              {dayItems.map((item) => {
                const category = item.categoryId
                  ? lookups.categoriesById.get(item.categoryId)
                  : undefined;
                const account = item.accountId
                  ? lookups.accountsById.get(item.accountId)
                  : undefined;
                const isTransfer = item.transferGroupId !== null;
                const title =
                  item.merchant ??
                  (isTransfer ? transactionTypeLabels[item.type] : category?.name) ??
                  transactionTypeLabels[item.type];
                const href = `/transactions/${item.id}`;
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => router.push(href)}
                  >
                    <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                      {formatTime(new Date(item.occurredAt), { timeZone: timezone })}
                    </TableCell>
                    <TableCell className="max-w-0 md:max-w-none">
                      <Link
                        href={href}
                        className="flex items-center gap-3 outline-none focus-visible:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <CategoryIcon
                          icon={isTransfer ? 'bank' : category?.icon}
                          color={isTransfer ? null : category?.color}
                          className="hidden sm:inline-flex"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{title}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {[
                              item.status === 'pending' ? transactionStatusLabels.pending : null,
                              item.note,
                              account?.name,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {isTransfer ? '—' : (category?.label ?? commonStrings.noCategory)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {account?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Amount
                        amountMinor={item.amountMinor}
                        currency={item.currency}
                        type={item.type}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </DayGroup>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DayGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableHead colSpan={5} scope="colgroup" className="h-8 text-xs font-medium">
          {heading}
        </TableHead>
      </TableRow>
      {children}
    </>
  );
}
