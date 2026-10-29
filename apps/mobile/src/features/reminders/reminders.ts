import { startOfDayInZone } from '@bolsillo/core/dates';
import { daysBetween } from '@bolsillo/core/recurring';
import type { UpcomingPayment } from '@bolsillo/core/schemas';

/** Identifiers of the reminders this module owns (other notifications are left alone). */
export const REMINDER_PREFIX = 'recurring:';

/** Local hour of the reminders. */
export const REMINDER_HOUR = 9;

/** iOS keeps at most 64 scheduled notifications per app. */
export const MAX_REMINDERS = 50;

export interface PlannedReminder {
  /** Changes when the due date or the reminder day changes. */
  id: string;
  title: string;
  body: string;
  date: Date;
}

function when(days: number): string {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'mañana';
  return `en ${days} días`;
}

/**
 * Local notifications for upcoming recurring payments, at 09:00 of the
 * reminder day in the user's time zone. They show the name and when it is
 * due, never the amount: they are visible on the lock screen.
 */
export function planReminders(
  items: readonly UpcomingPayment[],
  options: { now: Date; timezone: string; hour?: number; limit?: number },
): PlannedReminder[] {
  const hour = options.hour ?? REMINDER_HOUR;
  return items
    .map((item) => ({
      id: `${REMINDER_PREFIX}${item.recurringPaymentId}:${item.dueOn}:${item.remindOn}`,
      title: `${item.name} vence ${when(daysBetween(item.remindOn, item.dueOn))}`,
      body: 'Toca para registrar el pago.',
      date: new Date(
        startOfDayInZone(item.remindOn, options.timezone).getTime() + hour * 3_600_000,
      ),
    }))
    .filter((reminder) => reminder.date > options.now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, options.limit ?? MAX_REMINDERS);
}

/** What the platform can do with scheduled notifications (expo-notifications on the phone). */
export interface ReminderScheduler {
  /** Identifiers of the scheduled reminders owned by this module. */
  scheduled(): Promise<string[]>;
  schedule(reminder: PlannedReminder): Promise<void>;
  cancel(id: string): Promise<void>;
}

/**
 * Makes the scheduled reminders match the plan: cancels the ones that are no
 * longer planned and schedules the missing ones.
 */
export async function syncReminders(
  scheduler: ReminderScheduler,
  plan: readonly PlannedReminder[],
): Promise<{ scheduled: number; cancelled: number }> {
  const current = new Set(await scheduler.scheduled());
  const planned = new Set(plan.map((reminder) => reminder.id));
  const stale = [...current].filter((id) => !planned.has(id));
  const missing = plan.filter((reminder) => !current.has(reminder.id));
  for (const id of stale) await scheduler.cancel(id);
  for (const reminder of missing) await scheduler.schedule(reminder);
  return { scheduled: missing.length, cancelled: stale.length };
}
