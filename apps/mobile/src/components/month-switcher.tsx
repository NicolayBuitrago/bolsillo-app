import { useSettings } from '@bolsillo/api-client';
import { formatMonth, getMonthRange, shiftMonthKey, toMonthKey } from '@bolsillo/core/dates';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

/** Selected `YYYY-MM` in the user's time zone (current month first); `null` until settings load. */
export function useMonthState() {
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? null;
  const [month, setMonth] = useState<string | null>(null);
  return {
    month: month ?? (timezone ? toMonthKey(new Date(), timezone) : null),
    timezone,
    setMonth,
  };
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
  const arrow = (direction: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction < 0 ? 'Mes anterior' : 'Mes siguiente'}
      onPress={() => onChange(shiftMonthKey(month, direction))}
      className="size-11 items-center justify-center"
    >
      <Ionicons
        name={direction < 0 ? 'chevron-back' : 'chevron-forward'}
        size={22}
        color="#64748b"
      />
    </Pressable>
  );
  return (
    <View className="flex-row items-center justify-center">
      {arrow(-1)}
      <Text
        accessibilityLiveRegion="polite"
        className="min-w-36 text-center font-medium text-foreground"
      >
        {formatMonth(getMonthRange(month, timezone).start, { timeZone: timezone })}
      </Text>
      {arrow(1)}
    </View>
  );
}
