import type { Metadata } from 'next';
import { transactionStrings as t } from '@/features/transactions/strings';
import { TransactionForm } from '@/features/transactions/transaction-form';

export const metadata: Metadata = { title: 'Nuevo movimiento · Bolsillo' };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.newTitle}</h1>
      <TransactionForm />
    </div>
  );
}
