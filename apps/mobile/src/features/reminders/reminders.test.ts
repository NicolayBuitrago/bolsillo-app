import type { UpcomingPayment } from '@bolsillo/core/schemas';
import {
  type PlannedReminder,
  planReminders,
  REMINDER_PREFIX,
  type ReminderScheduler,
  syncReminders,
} from './reminders';

const NOW = new Date('2026-10-29T15:00:00Z'); // 10:00 in Bogotá

function upcoming(overrides: Partial<UpcomingPayment>): UpcomingPayment {
  return {
    recurringPaymentId: 'rent',
    name: 'Arriendo',
    dueOn: '2026-11-05',
    remindOn: '2026-11-03',
    amountMinor: 1_800_000_00,
    currency: 'COP',
    autoCreate: true,
    ...overrides,
  };
}

function fakeScheduler(initial: string[] = []) {
  const ids = new Set(initial);
  const scheduler: ReminderScheduler & { ids: Set<string>; scheduledReminders: PlannedReminder[] } =
    {
      ids,
      scheduledReminders: [],
      scheduled: async () => [...ids],
      schedule: async (reminder) => {
        ids.add(reminder.id);
        scheduler.scheduledReminders.push(reminder);
      },
      cancel: async (id) => {
        ids.delete(id);
      },
    };
  return scheduler;
}

describe('planReminders', () => {
  it('reminds at 09:00 local time without the amount', () => {
    const [reminder] = planReminders([upcoming({})], { now: NOW, timezone: 'America/Bogota' });
    expect(reminder).toEqual({
      id: `${REMINDER_PREFIX}rent:2026-11-05:2026-11-03`,
      title: 'Arriendo vence en 2 días',
      body: 'Toca para registrar el pago.',
      date: new Date('2026-11-03T14:00:00Z'),
    });
    expect(JSON.stringify(reminder)).not.toMatch(/1\.?800/);
  });

  it('words today and tomorrow', () => {
    const plan = planReminders(
      [
        upcoming({
          recurringPaymentId: 'a',
          name: 'Netflix',
          dueOn: '2026-11-01',
          remindOn: '2026-11-01',
        }),
        upcoming({
          recurringPaymentId: 'b',
          name: 'Energía',
          dueOn: '2026-11-02',
          remindOn: '2026-11-01',
        }),
      ],
      { now: NOW, timezone: 'America/Bogota' },
    );
    expect(plan.map((reminder) => reminder.title)).toEqual([
      'Netflix vence hoy',
      'Energía vence mañana',
    ]);
  });

  it('skips reminders whose time already passed and orders and caps the rest', () => {
    const items = [
      upcoming({ recurringPaymentId: 'past', remindOn: '2026-10-29' }), // 09:00 today < 10:00 now
      upcoming({ recurringPaymentId: 'late', remindOn: '2026-11-20', dueOn: '2026-11-22' }),
      upcoming({ recurringPaymentId: 'soon', remindOn: '2026-10-30', dueOn: '2026-10-31' }),
    ];
    const plan = planReminders(items, { now: NOW, timezone: 'America/Bogota', limit: 1 });
    expect(plan.map((reminder) => reminder.id)).toEqual([
      `${REMINDER_PREFIX}soon:2026-10-31:2026-10-30`,
    ]);
  });
});

describe('syncReminders', () => {
  it('schedules missing reminders and cancels stale ones only', async () => {
    const plan = planReminders(
      [
        upcoming({}),
        upcoming({ recurringPaymentId: 'netflix', dueOn: '2026-11-15', remindOn: '2026-11-13' }),
      ],
      { now: NOW, timezone: 'America/Bogota' },
    );
    const kept = plan[0]?.id ?? '';
    const scheduler = fakeScheduler([kept, `${REMINDER_PREFIX}old:2026-10-01:2026-09-29`]);

    await expect(syncReminders(scheduler, plan)).resolves.toEqual({ scheduled: 1, cancelled: 1 });
    expect([...scheduler.ids].sort()).toEqual(plan.map((reminder) => reminder.id).sort());

    // Running again with the same data changes nothing.
    await expect(syncReminders(scheduler, plan)).resolves.toEqual({ scheduled: 0, cancelled: 0 });
  });

  it('cancels everything when there is nothing to remind', async () => {
    const scheduler = fakeScheduler([`${REMINDER_PREFIX}a:x:y`, `${REMINDER_PREFIX}b:x:y`]);
    await expect(syncReminders(scheduler, [])).resolves.toEqual({ scheduled: 0, cancelled: 2 });
    expect(scheduler.ids.size).toBe(0);
  });
});
