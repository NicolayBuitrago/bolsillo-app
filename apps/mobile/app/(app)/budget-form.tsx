import { useLocalSearchParams } from 'expo-router';
import { BudgetFormScreen } from '@/features/budgets/budget-form-screen';

export default function BudgetFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <BudgetFormScreen id={id} />;
}
