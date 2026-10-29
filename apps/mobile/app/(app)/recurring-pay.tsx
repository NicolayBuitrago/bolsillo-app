import { useLocalSearchParams } from 'expo-router';
import { RecurringPayScreen } from '@/features/recurring/recurring-pay-screen';

export default function RecurringPayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecurringPayScreen id={id} />;
}
