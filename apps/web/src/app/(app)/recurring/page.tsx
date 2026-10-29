import type { Metadata } from 'next';
import { RecurringPage } from '@/features/recurring/recurring-page';

export const metadata: Metadata = { title: 'Pagos recurrentes · Bolsillo' };

export default function Page() {
  return <RecurringPage />;
}
