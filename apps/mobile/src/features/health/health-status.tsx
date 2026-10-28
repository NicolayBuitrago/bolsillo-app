import { useHealth } from '@bolsillo/api-client';
import { Pressable, Text, View } from 'react-native';
import { healthStrings as t } from './strings';

export type ServiceState = 'loading' | 'ok' | 'down';

const badgeStyles: Record<ServiceState, { box: string; text: string; label: string }> = {
  loading: { box: 'border border-border', text: 'text-muted-foreground', label: t.loading },
  ok: { box: 'bg-primary', text: 'text-primary-foreground', label: t.ok },
  down: { box: 'bg-destructive', text: 'text-destructive-foreground', label: t.down },
};

function StatusRow({ label, state }: { label: string; state: ServiceState }) {
  const badge = badgeStyles[state];
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-base text-card-foreground">{label}</Text>
      <View className={`rounded-xl px-3 py-1 ${badge.box}`}>
        <Text className={`text-sm font-medium ${badge.text}`}>{badge.label}</Text>
      </View>
    </View>
  );
}

export interface HealthStatusViewProps {
  api: ServiceState;
  db: ServiceState;
  onRetry: () => void;
  retrying: boolean;
}

export function HealthStatusView({ api, db, onRetry, retrying }: HealthStatusViewProps) {
  return (
    <View className="w-full max-w-sm gap-4">
      <Text className="text-center text-3xl font-semibold text-foreground">{t.appName}</Text>
      <View className="rounded-xl border border-border bg-card p-5">
        <Text className="text-lg font-semibold text-card-foreground">{t.title}</Text>
        <Text className="mb-2 text-sm text-muted-foreground">{t.description}</Text>
        <StatusRow label={t.api} state={api} />
        <StatusRow label={t.database} state={db} />
        {api === 'down' ? (
          <View className="mt-3 gap-3" accessibilityRole="alert">
            <Text className="text-sm text-muted-foreground">{t.unreachable}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              disabled={retrying}
              className="min-h-11 items-center justify-center rounded-lg border border-border px-4"
            >
              <Text className="font-medium text-foreground">{t.retry}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function HealthStatus() {
  const { data, isPending, isError, isFetching, refetch } = useHealth();
  const api: ServiceState = isPending ? 'loading' : isError ? 'down' : 'ok';
  const db: ServiceState = isPending ? 'loading' : data?.db === 'ok' ? 'ok' : 'down';
  return <HealthStatusView api={api} db={db} onRetry={() => refetch()} retrying={isFetching} />;
}
