import { View } from 'react-native';
import { HealthStatus } from '@/features/health/health-status';

export default function StatusRoute() {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <HealthStatus />
    </View>
  );
}
