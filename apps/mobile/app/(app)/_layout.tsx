import { Stack } from 'expo-router';
import { useReminderSync } from '@/features/reminders/use-reminder-sync';

/** Signed-in area: tabs plus pushed screens with a native header. */
export default function AppLayout() {
  useReminderSync();
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="transaction/new"
        options={{ title: 'Nuevo movimiento', presentation: 'modal' }}
      />
      <Stack.Screen name="transaction/[id]" options={{ title: 'Editar movimiento' }} />
      <Stack.Screen name="transfer" options={{ title: 'Transferencia', presentation: 'modal' }} />
      <Stack.Screen name="categories" options={{ title: 'Categorías' }} />
      <Stack.Screen name="category-form" options={{ title: 'Categoría', presentation: 'modal' }} />
      <Stack.Screen name="account-form" options={{ title: 'Cuenta', presentation: 'modal' }} />
      <Stack.Screen
        name="adjust-balance"
        options={{ title: 'Ajustar saldo', presentation: 'modal' }}
      />
      <Stack.Screen name="status" options={{ title: 'Estado del sistema' }} />
      <Stack.Screen name="budgets" options={{ title: 'Presupuestos' }} />
      <Stack.Screen name="budget-form" options={{ title: 'Presupuesto', presentation: 'modal' }} />
      <Stack.Screen name="recurring" options={{ title: 'Pagos recurrentes' }} />
      <Stack.Screen
        name="recurring-form"
        options={{ title: 'Pago recurrente', presentation: 'modal' }}
      />
      <Stack.Screen
        name="recurring-pay"
        options={{ title: 'Registrar pago', presentation: 'modal' }}
      />
      <Stack.Screen name="reports" options={{ title: 'Reportes' }} />
    </Stack>
  );
}
