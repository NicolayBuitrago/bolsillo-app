import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

/** Floating "new transaction" button. */
export function NewTransactionFab() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nuevo movimiento"
      onPress={() => router.push('/transaction/new')}
      className="absolute right-5 bottom-5 size-16 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-80"
    >
      <Ionicons name="add" size={32} color="#ffffff" />
    </Pressable>
  );
}
