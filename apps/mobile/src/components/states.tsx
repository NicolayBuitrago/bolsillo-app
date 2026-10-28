import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from './ui';

export function LoadingState() {
  return (
    <View className="items-center justify-center p-8" accessibilityLabel="Cargando">
      <ActivityIndicator size="large" />
    </View>
  );
}

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <View
      accessibilityRole="alert"
      className="items-center gap-3 rounded-xl border border-dashed border-border p-6"
    >
      <Text className="text-center text-sm text-muted-foreground">
        {message ?? 'No se pudieron cargar los datos. Revisa tu conexión.'}
      </Text>
      <Button label="Reintentar" variant="outline" onPress={onRetry} />
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center gap-2 rounded-xl border border-dashed border-border p-6">
      <Text className="text-center font-semibold text-foreground">{title}</Text>
      {description ? (
        <Text className="text-center text-sm text-muted-foreground">{description}</Text>
      ) : null}
      {action}
    </View>
  );
}
