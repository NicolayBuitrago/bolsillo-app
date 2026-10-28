import { useLocalSearchParams } from 'expo-router';
import { AccountFormScreen } from '@/features/accounts/account-form-screen';

export default function AccountFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <AccountFormScreen id={id} />;
}
