import { useRecurringPayments, useSettings, useUpcomingPayments } from '@bolsillo/api-client';
import { DEFAULT_TIME_ZONE, startOfDayInZone, toDateKey } from '@bolsillo/core/dates';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { AmountText } from '@/components/amount-text';
import { ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui';

function formatDue(dueOn: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(startOfDayInZone(dueOn, timezone));
}

/** Next due dates (30 days, overdue included) with a pay button for the next one of each payment. */
export function UpcomingList({ limit }: { limit?: number }) {
  const router = useRouter();
  const upcoming = useUpcomingPayments(30);
  const payments = useRecurringPayments();
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? DEFAULT_TIME_ZONE;
  const today = toDateKey(new Date(), timezone);

  if (upcoming.isPending) return <LoadingState />;
  if (upcoming.isError) return <ErrorState onRetry={() => upcoming.refetch()} />;
  const items = limit ? upcoming.data.slice(0, limit) : upcoming.data;
  if (items.length === 0) {
    return (
      <Text className="text-sm text-muted-foreground">No hay pagos en los próximos 30 días.</Text>
    );
  }

  return (
    <View>
      {items.map((item) => {
        const payment = payments.data?.find(
          (candidate) => candidate.id === item.recurringPaymentId,
        );
        const status = item.dueOn < today ? 'Vencido' : item.dueOn === today ? 'Hoy' : null;
        return (
          <View
            key={`${item.recurringPaymentId}-${item.dueOn}`}
            className="min-h-16 flex-row items-center gap-3 border-b border-border py-2"
          >
            <View className="flex-1">
              <Text numberOfLines={1} className="font-medium text-foreground">
                {item.name}
              </Text>
              <Text
                className={`text-xs ${status === 'Vencido' ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {status ? `${status} · ` : ''}
                {formatDue(item.dueOn, timezone)}
              </Text>
            </View>
            {item.amountMinor === null ? (
              <Text className="text-xs text-muted-foreground">Variable</Text>
            ) : (
              <AmountText
                amountMinor={item.amountMinor}
                currency={item.currency}
                className="font-semibold"
              />
            )}
            {payment?.nextDueOn === item.dueOn ? (
              <Button
                label="Pagar"
                variant="outline"
                className="min-h-11 px-3"
                onPress={() =>
                  router.push({ pathname: '/recurring-pay', params: { id: payment.id } })
                }
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
