import type { Metadata } from 'next';
import { ReportsPage } from '@/features/reports/reports-page';

export const metadata: Metadata = { title: 'Reportes · Bolsillo' };

export default function Page() {
  return <ReportsPage />;
}
