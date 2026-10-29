import { useRecurringPayments } from '@bolsillo/api-client';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { AmountText } from '@/components/amount-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button, Card, SectionTitle } from '@/components/ui';
import { frequencyLabels, recurringStrings as t } from './strings';
import { UpcomingList } from './upcoming-list';

export function RecurringScreen() {
  const router = useRouter();
  const payments = useRecurringPayments();

  return (
    <ScrollView
      contentContainerClassName="gap-4 p-4 pb-12"
      refreshControl={
        <RefreshControl
          refreshing={payments.isRefetching}
          onRefresh={() => void payments.refetch()}
        />
      }
    >
      <Button
        label="Nuevo pago recurrente"
        variant="outline"
        onPress={() => router.push('/recurring-form')}
      />
      <Card className="gap-2">
        <SectionTitle>{t.upcoming}</SectionTitle>
        <UpcomingList />
      </Card>
      <Card className="gap-2">
        <SectionTitle>{t.all}</SectionTitle>
        {payments.isPending ? (
          <LoadingState />
        ) : payments.isError ? (
          <ErrorState onRetry={() => payments.refetch()} />
        ) : payments.data.length === 0 ? (
          <EmptyState
            title="Aún no tienes pagos recurrentes"
            description="Agrega arriendo, servicios o suscripciones para recibir recordatorios."
          />
        ) : (
          payments.data.map((payment) => (
            <Pressable
              key={payment.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/recurring-form', params: { id: payment.id } })
              }
              className={`min-h-16 flex-row items-center gap-3 border-b border-border py-2 active:opacity-70 ${payment.active ? '' : 'opacity-60'}`}
            >
              <View className="flex-1">
                <Text numberOfLines={1} className="font-medium text-foreground">
                  {payment.name}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {[
                    frequencyLabels[payment.frequency],
                    payment.active ? `próximo: ${payment.nextDueOn}` : 'Pausado',
                    payment.autoCreate ? 'Automático' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {payment.amountMinor === null ? (
                <Text className="text-xs text-muted-foreground">Variable</Text>
              ) : (
                <AmountText amountMinor={payment.amountMinor} currency={payment.currency} />
              )}
            </Pressable>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
