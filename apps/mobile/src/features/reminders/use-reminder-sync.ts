import { useSettings, useUpcomingPayments } from '@bolsillo/api-client';
import { DEFAULT_TIME_ZONE } from '@bolsillo/core/dates';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { planReminders, REMINDER_PREFIX, type ReminderScheduler, syncReminders } from './reminders';

const CHANNEL_ID = 'payment-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const expoScheduler: ReminderScheduler = {
  async scheduled() {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    return requests
      .map((request) => request.identifier)
      .filter((id) => id.startsWith(REMINDER_PREFIX));
  },
  async schedule(reminder) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: reminder.title, body: reminder.body, data: { url: '/recurring' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.date,
        channelId: CHANNEL_ID,
      },
    });
  },
  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
};

/** Asks for permission only on real devices and only when there is something to remind. */
async function ensurePermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios de pagos',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Keeps local reminders in sync with `GET /v1/recurring/upcoming?days=30`.
 * The query refetches when recurring payments change (mutations invalidate
 * it) and when the app returns to the foreground. Leaving the signed-in area
 * cancels every reminder.
 */
export function useReminderSync() {
  const router = useRouter();
  const upcoming = useUpcomingPayments(30);
  const settings = useSettings();
  const timezone = settings.data?.timezone ?? DEFAULT_TIME_ZONE;

  useEffect(() => {
    const items = upcoming.data;
    if (!items) return;
    void (async () => {
      try {
        if (items.length === 0) {
          await syncReminders(expoScheduler, []);
          return;
        }
        if (!(await ensurePermission())) return;
        await syncReminders(expoScheduler, planReminders(items, { now: new Date(), timezone }));
      } catch {
        // Reminders are best effort; the app works without them.
      }
    })();
  }, [upcoming.data, timezone]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.identifier.startsWith(REMINDER_PREFIX)) {
        router.push('/recurring');
      }
    });
    return () => {
      subscription.remove();
      void syncReminders(expoScheduler, []).catch(() => undefined);
    };
  }, [router]);
}
