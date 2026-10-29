import type { RecurrenceFrequency } from '@bolsillo/core/recurring';

export const frequencyLabels: Record<RecurrenceFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
};

export const REMIND_OPTIONS = [0, 1, 2, 3, 5, 7] as const;

export const recurringStrings = {
  upcoming: 'Próximos pagos',
  all: 'Todos los pagos',
} as const;
