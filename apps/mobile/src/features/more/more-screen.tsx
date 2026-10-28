import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useOutbox, useOutboxEntries } from '@/features/sync/outbox-provider';
import { authClient } from '@/lib/auth-client';

type IconName = ComponentProps<typeof Ionicons>['name'];

function MenuItem({ icon, label, href }: { icon: IconName; label: string; href: Href }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      className="min-h-14 flex-row items-center gap-3 border-b border-border px-1 active:opacity-70"
    >
      <Ionicons name={icon} size={22} color="#64748b" />
      <Text className="flex-1 text-base text-foreground">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );
}

export function MoreScreen() {
  const { data: session } = authClient.useSession();
  const outbox = useOutbox();
  const entries = useOutboxEntries(session?.user.id);
  const failed = entries.filter((entry) => entry.status === 'failed');

  const signOut = () => {
    const pending = entries.length;
    Alert.alert(
      'Cerrar sesión',
      pending > 0
        ? `Tienes ${pending} movimiento(s) sin sincronizar. Se enviarán cuando vuelvas a iniciar sesión con esta cuenta.`
        : '¿Quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: () => void authClient.signOut() },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1">
      <ScrollView contentContainerClassName="gap-6 p-4">
        <View className="gap-1">
          <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
            Más
          </Text>
          {session ? (
            <Text className="text-muted-foreground">
              {session.user.name} · {session.user.email}
            </Text>
          ) : null}
        </View>
        <View>
          <MenuItem icon="swap-horizontal-outline" label="Transferencia" href="/transfer" />
          <MenuItem icon="pricetags-outline" label="Categorías" href="/categories" />
          <MenuItem icon="pulse-outline" label="Estado del sistema" href="/status" />
        </View>
        {failed.length > 0 ? (
          <View className="gap-3 rounded-xl border border-destructive p-4">
            <Text className="font-semibold text-foreground">
              {failed.length} movimiento(s) no se pudieron guardar
            </Text>
            <Text className="text-sm text-muted-foreground">
              El servidor los rechazó (por ejemplo, la cuenta fue archivada). Puedes reintentar o
              descartarlos.
            </Text>
            <View className="flex-row gap-2">
              <Button
                label="Reintentar"
                variant="outline"
                className="flex-1"
                onPress={() => {
                  for (const entry of failed) outbox.retry(entry.id);
                  void outbox.flush();
                }}
              />
              <Button
                label="Descartar"
                variant="ghost"
                className="flex-1"
                onPress={() => {
                  for (const entry of failed) outbox.discard(entry.id);
                }}
              />
            </View>
          </View>
        ) : null}
        <Button label="Cerrar sesión" variant="outline" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
