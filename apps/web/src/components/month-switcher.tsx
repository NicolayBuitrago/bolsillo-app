'use client';

import { useSettings } from '@bolsillo/api-client';
import { formatMonth, getMonthRange, shiftMonthKey, toMonthKey } from '@bolsillo/core/dates';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Selected month (`YYYY-MM`) in the user's time zone, starting at the current
 * month. `null` until the settings load.
 */
export function useMonthState() {
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? null;
  const [month, setMonth] = useState<string | null>(null);
  const current = month ?? (timezone ? toMonthKey(new Date(), timezone) : null);
  return { month: current, timezone, setMonth };
}

export function MonthSwitcher({
  month,
  timezone,
  onChange,
}: {
  month: string | null;
  timezone: string | null;
  onChange: (month: string) => void;
}) {
  if (!month || !timezone) return null;
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Mes anterior"
        onClick={() => onChange(shiftMonthKey(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-36 text-center font-medium" aria-live="polite">
        {formatMonth(getMonthRange(month, timezone).start, { timeZone: timezone })}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Mes siguiente"
        onClick={() => onChange(shiftMonthKey(month, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
