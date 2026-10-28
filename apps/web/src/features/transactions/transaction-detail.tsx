'use client';

import { ApiError, useTransaction } from '@bolsillo/api-client';
import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/states';
import { buttonVariants } from '@/components/ui/button';
import { transactionStrings as t } from './strings';
import { TransactionForm } from './transaction-form';

export function TransactionDetail({ id }: { id: string }) {
  const transaction = useTransaction(id);
  if (transaction.isPending) return <LoadingState rows={5} />;
  if (transaction.isError) {
    if (transaction.error instanceof ApiError && transaction.error.status === 404) {
      return (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">{t.notFound}</p>
          <Link href="/transactions" className={buttonVariants({ variant: 'outline' })}>
            {t.back}
          </Link>
        </div>
      );
    }
    return <ErrorState onRetry={() => transaction.refetch()} />;
  }
  return <TransactionForm transaction={transaction.data} />;
}
