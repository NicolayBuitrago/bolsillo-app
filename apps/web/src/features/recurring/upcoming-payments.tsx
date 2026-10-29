'use client';

import { useRecurringPayments, useSettings, useUpcomingPayments } from '@bolsillo/api-client';
import { DEFAULT_TIME_ZONE, startOfDayInZone, toDateKey } from '@bolsillo/core/dates';
import type { RecurringPayment } from '@bolsillo/core/schemas';
import Link from 'next/link';
import { useState } from 'react';
import { Amount } from '@/components/money/amount';
import { ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PayDialog } from './pay-dialog';
import { recurringStrings as t } from './strings';

/** "Martes, 4 de noviembre" for a due date. */
function formatDue(dueOn: string, timezone: string) {
  const text = new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(startOfDayInZone(dueOn, timezone));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Due dates in the next 30 days (overdue first) with a quick "pay" action. */
export function UpcomingPayments({ limit }: { limit?: number }) {
  const upcoming = useUpcomingPayments(30);
  const payments = useRecurringPayments();
  const settings = useSettings();
  const [paying, setPaying] = useState<RecurringPayment | null>(null);
  const timezone = settings.data?.timezone ?? DEFAULT_TIME_ZONE;
  const today = toDateKey(new Date(), timezone);
  const items = limit ? upcoming.data?.slice(0, limit) : upcoming.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t.upcomingTitle}</CardTitle>
        {limit ? (
          <Link href="/recurring" className="text-sm underline underline-offset-4">
            {t.allTitle}
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        {upcoming.isPending ? (
          <LoadingState rows={2} />
        ) : upcoming.isError ? (
          <ErrorState onRetry={() => upcoming.refetch()} />
        ) : !items || items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.upcomingEmpty}</p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => {
              const payment = payments.data?.find(
                (candidate) => candidate.id === item.recurringPaymentId,
              );
              const isNext = payment?.nextDueOn === item.dueOn;
              return (
                <li
                  key={`${item.recurringPaymentId}-${item.dueOn}`}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="truncate">{item.name}</span>
                      {item.dueOn < today ? <Badge variant="destructive">{t.overdue}</Badge> : null}
                      {item.dueOn === today ? <Badge>{t.today}</Badge> : null}
                      {item.autoCreate ? <Badge variant="secondary">{t.auto}</Badge> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.dueOn} {formatDue(item.dueOn, timezone).toLowerCase()}
                    </span>
                  </div>
                  {item.amountMinor === null ? (
                    <span className="text-sm text-muted-foreground">{t.variable}</span>
                  ) : (
                    <Amount
                      amountMinor={item.amountMinor}
                      currency={item.currency}
                      className="font-medium"
                    />
                  )}
                  {payment && isNext ? (
                    <Button size="sm" variant="outline" onClick={() => setPaying(payment)}>
                      {t.pay}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <PayDialog
        payment={paying}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
      />
    </Card>
  );
}
