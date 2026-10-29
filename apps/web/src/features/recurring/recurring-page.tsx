'use client';

import { useAccounts, useRecurringPayments, useUpdateRecurring } from '@bolsillo/api-client';
import type { RecurringPayment } from '@bolsillo/core/schemas';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Amount } from '@/components/money/amount';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { commonStrings, frequencyLabels } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { PayDialog } from './pay-dialog';
import { RecurringDialog } from './recurring-dialog';
import { recurringStrings as t } from './strings';
import { UpcomingPayments } from './upcoming-payments';

export function RecurringPage() {
  const payments = useRecurringPayments();
  const accounts = useAccounts({ includeArchived: true });
  const update = useUpdateRecurring();
  const [editing, setEditing] = useState<RecurringPayment | 'new' | null>(null);
  const [paying, setPaying] = useState<RecurringPayment | null>(null);

  const toggleActive = async (payment: RecurringPayment) => {
    try {
      await update.mutateAsync({ id: payment.id, input: { active: !payment.active } });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <Button onClick={() => setEditing('new')}>
          <Plus data-icon="inline-start" />
          {t.newPayment}
        </Button>
      </div>

      <UpcomingPayments />

      <Card>
        <CardHeader>
          <CardTitle>{t.allTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.isPending ? (
            <LoadingState rows={3} />
          ) : payments.isError ? (
            <ErrorState onRetry={() => payments.refetch()} />
          ) : payments.data.length === 0 ? (
            <EmptyState
              title={t.emptyTitle}
              description={t.emptyHint}
              action={<Button onClick={() => setEditing('new')}>{t.newPayment}</Button>}
            />
          ) : (
            <ul className="divide-y">
              {payments.data.map((payment) => {
                const account = accounts.data?.find((item) => item.id === payment.accountId);
                return (
                  <li
                    key={payment.id}
                    className={`flex items-center gap-3 py-3 ${payment.active ? '' : 'opacity-60'}`}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="truncate">{payment.name}</span>
                        {payment.active ? null : <Badge variant="outline">{t.paused}</Badge>}
                        {payment.autoCreate ? <Badge variant="secondary">{t.auto}</Badge> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[
                          frequencyLabels[payment.frequency],
                          `${t.nextDue.toLowerCase()}: ${payment.nextDueOn}`,
                          account?.name,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    {payment.amountMinor === null ? (
                      <span className="text-sm text-muted-foreground">{t.variable}</span>
                    ) : (
                      <Amount amountMinor={payment.amountMinor} currency={payment.currency} />
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${commonStrings.actions}: ${payment.name}`}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {payment.active ? (
                          <DropdownMenuItem onClick={() => setPaying(payment)}>
                            {t.pay}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={() => setEditing(payment)}>
                          {commonStrings.edit}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(payment)}>
                          {payment.active ? t.pause : t.resume}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <RecurringDialog
        open={editing !== null}
        payment={editing === 'new' || editing === null ? undefined : editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
      <PayDialog
        payment={paying}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
      />
    </div>
  );
}
