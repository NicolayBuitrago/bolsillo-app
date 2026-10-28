import { SafeAreaView } from 'react-native-safe-area-context';
import { HealthStatus } from '@/features/health/health-status';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-6 p-6">
      <HealthStatus />
    </SafeAreaView>
  );
}
