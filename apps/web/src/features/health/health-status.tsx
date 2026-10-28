'use client';

import { useHealth } from '@bolsillo/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { healthStrings as t } from './strings';

function StatusRow({ label, ok }: { label: string; ok: boolean | undefined }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span>{label}</span>
      {ok === undefined ? (
        <Badge variant="outline">{t.loading}</Badge>
      ) : (
        <Badge variant={ok ? 'default' : 'destructive'}>{ok ? t.ok : t.down}</Badge>
      )}
    </div>
  );
}

export function HealthStatus() {
  const { data, isError, isPending, refetch, isFetching } = useHealth();
  const apiOk = isPending ? undefined : !isError;
  const dbOk = isPending ? undefined : data?.db === 'ok';

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <StatusRow label={t.api} ok={apiOk} />
        <StatusRow label={t.database} ok={dbOk} />
        {isError ? (
          <div className="mt-4 flex items-center justify-between gap-4" role="alert">
            <p className="text-sm text-muted-foreground">{t.unreachable}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {t.retry}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
