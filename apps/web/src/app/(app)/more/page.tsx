import type { Metadata } from 'next';
import { MorePage } from '@/features/shared/more-page';

export const metadata: Metadata = { title: 'Más · Bolsillo' };

export default function Page() {
  return <MorePage />;
}
