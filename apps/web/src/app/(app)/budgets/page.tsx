import type { Metadata } from 'next';
import { BudgetsPage } from '@/features/budgets/budgets-page';

export const metadata: Metadata = { title: 'Presupuestos · Bolsillo' };

export default function Page() {
  return <BudgetsPage />;
}
