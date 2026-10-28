'use client';

import { useAccounts, useMonthlyReport, useSettings } from '@bolsillo/api-client';
import { formatMonth, getMonthRange, shiftMonthKey, toMonthKey } from '@bolsillo/core/dates';
import type { Account, MonthlyReport } from '@bolsillo/core/schemas';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CategoryIcon } from '@/components/category-icon';
import { Amount } from '@/components/money/amount';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { accountTypeLabels } from '@/features/shared/strings';
import { homeStrings as t } from './strings';

export function HomePage() {
  const settings = useSettings();
  const timezone = settings.data?.timezone;
  const [month, setMonth] = useState<string | null>(null);
  const currentMonth = month ?? (timezone ? toMonthKey(new Date(), timezone) : null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        {currentMonth && timezone ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.previousMonth}
              onClick={() => setMonth(shiftMonthKey(currentMonth, -1))}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-36 text-center font-medium" aria-live="polite">
              {formatMonth(getMonthRange(currentMonth, timezone).start, { timeZone: timezone })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.nextMonth}
              onClick={() => setMonth(shiftMonthKey(currentMonth, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>
      {currentMonth ? <MonthSummary month={currentMonth} /> : <LoadingState rows={3} />}
      <Balances />
    </div>
  );
}

function MonthSummary({ month }: { month: string }) {
  const report = useMonthlyReport(month);
  if (report.isPending) return <LoadingState rows={3} />;
  if (report.isError) return <ErrorState onRetry={() => report.refetch()} />;
  return (
    <>
      <Totals report={report.data} />
      <SpendingByCategory report={report.data} />
    </>
  );
}

function Totals({ report }: { report: MonthlyReport }) {
  const totals =
    report.totals.length > 0
      ? report.totals
      : [{ currency: 'COP' as const, incomeMinor: 0, expenseMinor: 0, netMinor: 0 }];
  return (
    <div className="flex flex-col gap-3">
      {totals.map((row) => (
        <div key={row.currency} className="grid gap-3 sm:grid-cols-3">
          <Stat label={t.income} currency={row.currency}>
            <Amount amountMinor={row.incomeMinor} currency={row.currency} type="income" />
          </Stat>
          <Stat label={t.expenses} currency={row.currency}>
            <Amount amountMinor={row.expenseMinor} currency={row.currency} type="expense" />
          </Stat>
          <Stat label={t.net} currency={row.currency}>
            <Amount amountMinor={row.netMinor} currency={row.currency} />
          </Stat>
        </div>
      ))}
    </div>
  );
}

function Stat({
  label,
  currency,
  children,
}: {
  label: string;
  currency: string;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">
          {label} <span className="text-xs">({currency})</span>
        </span>
        <span className="text-2xl font-semibold">{children}</span>
      </CardContent>
    </Card>
  );
}

function SpendingByCategory({ report }: { report: MonthlyReport }) {
  const expenses = report.byCategory.filter((row) => row.kind === 'expense');
  const totalByCurrency = new Map<string, number>();
  for (const row of expenses) {
    totalByCurrency.set(row.currency, (totalByCurrency.get(row.currency) ?? 0) + row.totalMinor);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.byCategory}</CardTitle>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.byCategoryEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {expenses.map((row) => {
              const share = row.totalMinor / (totalByCurrency.get(row.currency) ?? row.totalMinor);
              const percent = Math.round(share * 100);
              return (
                <li key={`${row.categoryId}-${row.currency}`} className="flex items-center gap-3">
                  <CategoryIcon icon={row.icon} color={row.color} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate">{row.name ?? t.uncategorized}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {percent} %
                        </span>
                        <Amount amountMinor={row.totalMinor} currency={row.currency} />
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(share * 100, 2)}%`,
                          backgroundColor: row.color ?? 'var(--muted-foreground)',
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Balances() {
  const accounts = useAccounts();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.balances}</CardTitle>
      </CardHeader>
      <CardContent>
        {accounts.isPending ? (
          <LoadingState rows={3} />
        ) : accounts.isError ? (
          <ErrorState onRetry={() => accounts.refetch()} />
        ) : accounts.data.length === 0 ? (
          <EmptyState
            title={t.noAccounts}
            description={t.noAccountsHint}
            action={
              <Link href="/accounts" className={buttonVariants()}>
                {t.createAccount}
              </Link>
            }
          />
        ) : (
          <ul className="divide-y">
            {accounts.data.map((account) => (
              <BalanceRow key={account.id} account={account} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function BalanceRow({ account }: { account: Account }) {
  const isCard = account.type === 'credit_card';
  return (
    <li className="flex items-center gap-3 py-3">
      <CategoryIcon icon={account.icon} color={account.color} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{account.name}</span>
        <span className="text-xs text-muted-foreground">{accountTypeLabels[account.type]}</span>
      </div>
      <div className="flex flex-col items-end">
        {isCard ? <span className="text-xs text-muted-foreground">{t.debt}</span> : null}
        <Amount
          amountMinor={isCard ? Math.abs(Math.min(account.balanceMinor, 0)) : account.balanceMinor}
          currency={account.currency}
          className="font-medium"
        />
        {isCard && account.creditLimitMinor ? (
          <span className="text-xs text-muted-foreground">
            {t.available}:{' '}
            <Amount
              amountMinor={account.creditLimitMinor + account.balanceMinor}
              currency={account.currency}
            />
          </span>
        ) : null}
      </div>
    </li>
  );
}
