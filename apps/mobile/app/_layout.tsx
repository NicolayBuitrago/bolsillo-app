import '../global.css';
import {
  ApiClientProvider,
  createApiClient,
  createQueryClient,
  QueryClientProvider,
} from '@bolsillo/api-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { env } from '@/lib/env';
import { themeVars } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [queryClient] = useState(createQueryClient);
  const [apiClient] = useState(() => createApiClient(env.EXPO_PUBLIC_API_URL));

  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        <View style={themeVars[scheme]} className="flex-1 bg-background">
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
          />
          <StatusBar style="auto" />
        </View>
      </ApiClientProvider>
    </QueryClientProvider>
  );
}
