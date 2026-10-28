import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { useOutbox, useOutboxEntries } from './outbox-provider';

/** Shows how many transactions are still only on the phone. */
export function SyncBanner({ userId }: { userId: string | null }) {
  const outbox = useOutbox();
  const entries = useOutboxEntries(userId);
  if (entries.length === 0) return null;
  const failed = entries.filter((entry) => entry.status === 'failed').length;
  const pending = entries.length - failed;
  const message = [
    pending > 0 ? `${pending} sin sincronizar` : null,
    failed > 0 ? `${failed} con error` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${message}. Reintentar envío`}
      onPress={() => void outbox.flush()}
      className="flex-row items-center gap-3 rounded-xl border border-warning bg-card p-3"
    >
      <Ionicons name="cloud-offline-outline" size={20} color="#d97706" />
      <View className="flex-1">
        <Text className="font-medium text-foreground">{message}</Text>
        <Text className="text-xs text-muted-foreground">
          Se envían solos al recuperar la conexión. Toca para reintentar.
        </Text>
      </View>
    </Pressable>
  );
}
