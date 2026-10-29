import { useLocalSearchParams } from 'expo-router';
import { RecurringFormScreen } from '@/features/recurring/recurring-form-screen';

export default function RecurringFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <RecurringFormScreen id={id} />;
}
