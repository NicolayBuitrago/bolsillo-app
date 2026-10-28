import type { CategoryKind } from '@bolsillo/core/schemas';
import { useLocalSearchParams } from 'expo-router';
import { CategoryFormScreen } from '@/features/categories/category-form-screen';

export default function CategoryFormRoute() {
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: CategoryKind }>();
  return <CategoryFormScreen id={id} kind={kind} />;
}
