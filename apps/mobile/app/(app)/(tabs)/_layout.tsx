import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

type IconProps = ComponentProps<typeof Ionicons>;

const icon =
  (name: IconProps['name']) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#0f766e' }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen
        name="transactions"
        options={{ title: 'Movimientos', tabBarIcon: icon('list-outline') }}
      />
      <Tabs.Screen
        name="accounts"
        options={{ title: 'Cuentas', tabBarIcon: icon('wallet-outline') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'Más', tabBarIcon: icon('ellipsis-horizontal-outline') }}
      />
    </Tabs>
  );
}
