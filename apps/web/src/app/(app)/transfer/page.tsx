import type { Metadata } from 'next';
import { transactionStrings as t } from '@/features/transactions/strings';
import { TransferForm } from '@/features/transactions/transfer-form';

export const metadata: Metadata = { title: 'Transferencia · Bolsillo' };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.transferTitle}</h1>
      <TransferForm />
    </div>
  );
}
