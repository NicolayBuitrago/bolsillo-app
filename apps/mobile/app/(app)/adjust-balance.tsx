import { useLocalSearchParams } from 'expo-router';
import { AdjustBalanceScreen } from '@/features/accounts/adjust-balance-screen';

export default function AdjustBalanceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdjustBalanceScreen id={id} />;
}
