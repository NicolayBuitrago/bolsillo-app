'use client';

import { useMonthlyReport, useTrend } from '@bolsillo/api-client';
import { formatMonth, getMonthRange } from '@bolsillo/core/dates';
import type { CurrencyCode } from '@bolsillo/core/money';
import type { MonthlyReport, TrendReport } from '@bolsillo/core/schemas';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { CategoryIcon } from '@/components/category-icon';
import { Amount } from '@/components/money/amount';
import { MonthSwitcher, useMonthState } from '@/components/month-switcher';
import { ErrorState, LoadingState } from '@/components/states';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { reportStrings as t } from './strings';

export function ReportsPage() {
  const { month, timezone, setMonth } = useMonthState();
  const report = useMonthlyReport(month);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <MonthSwitcher month={month} timezone={timezone} onChange={setMonth} />
      </div>
      {report.isPending ? (
        <LoadingState rows={4} />
      ) : report.isError ? (
        <ErrorState onRetry={() => report.refetch()} />
      ) : (
        <MonthlySection report={report.data} />
      )}
      <TrendSection timezone={timezone} />
      <ExportSection />
    </div>
  );
}

function MonthlySection({ report }: { report: MonthlyReport }) {
  if (report.totals.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      {report.totals.map((row) => (
        <div key={row.currency} className="grid gap-3 sm:grid-cols-3">
          {(
            [
              [t.income, row.incomeMinor, 'income'],
              [t.expenses, row.expenseMinor, 'expense'],
              [t.net, row.netMinor, undefined],
            ] as const
          ).map(([label, value, type]) => (
            <Card key={label} size="sm">
              <CardContent className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">
                  {label} ({row.currency})
                </span>
                <Amount
                  amountMinor={value}
                  currency={row.currency}
                  {...(type ? { type } : {})}
                  className="text-2xl font-semibold"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBreakdown report={report} kind="expense" title={t.expensesByCategory} />
        <CategoryBreakdown report={report} kind="income" title={t.incomeByCategory} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.byAccount}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.account}</TableHead>
                <TableHead className="text-right">{t.income}</TableHead>
                <TableHead className="text-right">{t.expenses}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.byAccount.map((row) => (
                <TableRow key={`${row.accountId}-${row.currency}`}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right">
                    <Amount amountMinor={row.incomeMinor} currency={row.currency} type="income" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Amount amountMinor={row.expenseMinor} currency={row.currency} type="expense" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function CategoryBreakdown({
  report,
  kind,
  title,
}: {
  report: MonthlyReport;
  kind: 'expense' | 'income';
  title: string;
}) {
  const rows = report.byCategory.filter((row) => row.kind === kind);
  const totals = new Map<string, number>();
  for (const row of rows)
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.totalMinor);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => {
              const share = row.totalMinor / (totals.get(row.currency) ?? row.totalMinor);
              return (
                <li key={`${row.categoryId}-${row.currency}`} className="flex items-center gap-3">
                  <CategoryIcon icon={row.icon} color={row.color} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex justify-between gap-2">
                      <span className="truncate">{row.name ?? t.uncategorized}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {Math.round(share * 100)} %
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

const TREND_OPTIONS = [6, 12] as const;

function TrendSection({ timezone }: { timezone: string | null }) {
  const [months, setMonths] = useState<(typeof TREND_OPTIONS)[number]>(6);
  const trend = useTrend(months);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t.trend}</CardTitle>
        <div className="flex gap-1">
          {TREND_OPTIONS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={months === option ? 'default' : 'outline'}
              aria-pressed={months === option}
              onClick={() => setMonths(option)}
            >
              {option} {t.months}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {trend.isPending || !timezone ? (
          <LoadingState rows={3} />
        ) : trend.isError ? (
          <ErrorState onRetry={() => trend.refetch()} />
        ) : (
          <TrendChart trend={trend.data} timezone={timezone} />
        )}
      </CardContent>
    </Card>
  );
}

/** Income/expense bars per month (one chart per currency) plus the same data as a table. */
function TrendChart({ trend, timezone }: { trend: TrendReport; timezone: string }) {
  const currencies = [
    ...new Set(trend.months.flatMap((item) => item.totals.map((total) => total.currency))),
  ] as CurrencyCode[];
  if (currencies.length === 0)
    return <p className="text-sm text-muted-foreground">{t.trendEmpty}</p>;

  const label = (month: string) =>
    formatMonth(getMonthRange(month, timezone).start, { timeZone: timezone }).replace(
      / de \d{4}$/,
      '',
    );

  return (
    <div className="flex flex-col gap-8">
      {currencies.map((currency) => {
        const rows = trend.months.map((item) => {
          const total = item.totals.find((candidate) => candidate.currency === currency);
          return {
            month: item.month,
            income: total?.incomeMinor ?? 0,
            expense: total?.expenseMinor ?? 0,
            net: total?.netMinor ?? 0,
          };
        });
        const max = Math.max(1, ...rows.flatMap((row) => [row.income, row.expense]));
        return (
          <div key={currency} className="flex flex-col gap-4">
            {currencies.length > 1 ? <span className="text-sm font-medium">{currency}</span> : null}
            <div className="flex h-48 items-end gap-2" aria-hidden="true">
              {rows.map((row) => (
                <div key={row.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-40 w-full items-end justify-center gap-1">
                    <div
                      className="w-1/3 max-w-6 rounded-t bg-income"
                      style={{ height: `${(row.income / max) * 100}%` }}
                    />
                    <div
                      className="w-1/3 max-w-6 rounded-t bg-expense"
                      style={{ height: `${(row.expense / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{label(row.month)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground" aria-hidden="true">
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-income" /> {t.income}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-expense" /> {t.expenses}
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.month}</TableHead>
                    <TableHead className="text-right">{t.income}</TableHead>
                    <TableHead className="text-right">{t.expenses}</TableHead>
                    <TableHead className="text-right">{t.net}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell>{label(row.month)}</TableCell>
                      <TableCell className="text-right">
                        <Amount amountMinor={row.income} currency={currency} type="income" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Amount amountMinor={row.expense} currency={currency} type="expense" />
                      </TableCell>
                      <TableCell className={cn('text-right font-medium')}>
                        <Amount amountMinor={row.net} currency={currency} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExportSection() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  // Same-origin link: the session cookie goes with it and the API answers with
  // Content-Disposition: attachment.
  const href = `/api/v1/export/transactions.csv${query ? `?${query}` : ''}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.exportTitle}</CardTitle>
        <CardDescription>{t.exportDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-from">{t.from}</Label>
          <Input
            id="export-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-to">{t.to}</Label>
          <Input
            id="export-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <a href={href} download className={buttonVariants()}>
          <Download data-icon="inline-start" />
          {t.download}
        </a>
      </CardContent>
    </Card>
  );
}
