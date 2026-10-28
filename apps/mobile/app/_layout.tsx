import '../global.css';
import { ApiClientProvider } from '@bolsillo/api-client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { OutboxProvider } from '@/features/sync/outbox-provider';
import { apiClient } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { clearLocalData, queryClient, queryPersister } from '@/lib/query';
import { themeVars } from '@/lib/theme';

const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id ?? null;

  // Cached data belongs to one user: drop it when the user changes or signs out.
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isPending) return;
    if (previousUser.current !== undefined && previousUser.current !== userId) {
      clearLocalData();
    }
    previousUser.current = userId;
  }, [isPending, userId]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: MAX_CACHE_AGE, buster: userId ?? '' }}
    >
      <ApiClientProvider client={apiClient}>
        <OutboxProvider userId={userId}>
          <View style={themeVars[scheme]} className="flex-1 bg-background">
            {isPending ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              >
                <Stack.Protected guard={userId !== null}>
                  <Stack.Screen name="(app)" />
                </Stack.Protected>
                <Stack.Protected guard={userId === null}>
                  <Stack.Screen name="(auth)" />
                </Stack.Protected>
              </Stack>
            )}
            <StatusBar style="auto" />
          </View>
        </OutboxProvider>
      </ApiClientProvider>
    </PersistQueryClientProvider>
  );
}
