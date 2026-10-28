import type { Metadata } from 'next';
import { CategoriesPage } from '@/features/categories/categories-page';

export const metadata: Metadata = { title: 'Categorías · Bolsillo' };

export default function Page() {
  return <CategoriesPage />;
}
