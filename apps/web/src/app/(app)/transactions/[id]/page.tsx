import type { Metadata } from 'next';
import { transactionStrings as t } from '@/features/transactions/strings';
import { TransactionDetail } from '@/features/transactions/transaction-detail';

export const metadata: Metadata = { title: 'Editar movimiento · Bolsillo' };

export default async function Page({ params }: PageProps<'/transactions/[id]'>) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.editTitle}</h1>
      <TransactionDetail id={id} />
    </div>
  );
}
