import { startOfDayInZone, toDateKey } from '@bolsillo/core/dates';
import { newId } from '@bolsillo/core/ids';
import { addDays, nextDueAfter, occurrencesBetween } from '@bolsillo/core/recurring';
import {
  type createRecurringPaymentSchema,
  type payRecurringPaymentSchema,
  type RecurringPayment,
  type RecurringPaymentResult,
  UPCOMING_DAYS,
  type UpcomingPayment,
  type updateRecurringPaymentSchema,
} from '@bolsillo/core/schemas';
import type { Database } from '@bolsillo/db';
import type { z } from 'zod';
import { BusinessRuleError, NotFoundError } from '../../errors';
import type { Patch } from '../../lib/patch';
import type { AccountsService } from '../accounts/service';
import type { CategoriesService } from '../categories/service';
import type { SettingsService } from '../settings/service';
import { toTransaction } from '../transactions/dto';
import { confirmTransaction, insertTransaction } from '../transactions/repository';
import {
  findRecurring,
  insertRecurring,
  listRecurring,
  lockRecurring,
  oldestPendingOccurrence,
  type RecurringInsert,
  type RecurringRow,
  updateRecurring,
} from './repository';

type CreateRecurring = z.infer<typeof createRecurringPaymentSchema>;
type UpdateRecurring = z.infer<typeof updateRecurringPaymentSchema>;
type PayRecurring = z.infer<typeof payRecurringPaymentSchema>;

const AUTO_CREATE_NEEDS_AMOUNT =
  'Para crear el movimiento automáticamente se necesita un monto fijo';

export function toRecurringPayment(row: RecurringRow): RecurringPayment {
  return {
    id: row.id,
    name: row.name,
    accountId: row.accountId,
    categoryId: row.categoryId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    frequency: row.frequency,
    anchorOn: row.anchorOn,
    nextDueOn: row.nextDueOn,
    remindDaysBefore: row.remindDaysBefore,
    autoCreate: row.autoCreate,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Noon of the due date in the user's time zone: the instant used for its transaction. */
export function dueInstant(dueOn: string, timezone: string): Date {
  return new Date(startOfDayInZone(dueOn, timezone).getTime() + 12 * 3_600_000);
}

export interface RecurringServiceDeps {
  db: Database;
  settings: SettingsService;
  accounts: AccountsService;
  categories: CategoriesService;
}

export function createRecurringService({
  db,
  settings,
  accounts,
  categories,
}: RecurringServiceDeps) {
  async function requirePayment(userId: string, id: string): Promise<RecurringRow> {
    const row = await findRecurring(db, userId, id);
    if (!row) throw new NotFoundError('Pago recurrente no encontrado');
    return row;
  }

  /** The account fixes the currency; without one, the given or default currency is used. */
  async function resolveAccount(
    userId: string,
    accountId: string | null | undefined,
    currency: string | undefined,
  ) {
    if (!accountId) return null;
    const account = await accounts.assertUsable(userId, accountId);
    if (currency && currency !== account.currency) {
      throw new BusinessRuleError('La moneda debe ser la de la cuenta');
    }
    return account;
  }

  return {
    async list(userId: string): Promise<RecurringPayment[]> {
      return (await listRecurring(db, userId)).map(toRecurringPayment);
    },

    async create(userId: string, input: CreateRecurring): Promise<RecurringPayment> {
      const account = await resolveAccount(userId, input.accountId, input.currency);
      await categories.assertUsable(userId, input.categoryId, 'expense');
      const currency =
        account?.currency ?? input.currency ?? (await settings.load(userId)).defaultCurrency;
      const row = await insertRecurring(db, userId, {
        name: input.name,
        accountId: account?.id ?? null,
        categoryId: input.categoryId ?? null,
        amountMinor: input.amountMinor ?? null,
        currency,
        frequency: input.frequency,
        anchorOn: input.firstDueOn,
        nextDueOn: input.firstDueOn,
        remindDaysBefore: input.remindDaysBefore ?? 2,
        autoCreate: input.autoCreate ?? false,
      });
      if (!row) throw new Error('Recurring insert returned no row');
      return toRecurringPayment(row);
    },

    async update(userId: string, id: string, input: UpdateRecurring): Promise<RecurringPayment> {
      const current = await requirePayment(userId, id);
      const amountMinor = input.amountMinor === undefined ? current.amountMinor : input.amountMinor;
      const autoCreate = input.autoCreate ?? current.autoCreate;
      if (autoCreate && amountMinor === null) throw new BusinessRuleError(AUTO_CREATE_NEEDS_AMOUNT);

      const patch: Patch<RecurringInsert> = {
        name: input.name,
        amountMinor: input.amountMinor,
        frequency: input.frequency,
        remindDaysBefore: input.remindDaysBefore,
        autoCreate: input.autoCreate,
        active: input.active,
      };
      if (input.accountId !== undefined) {
        const account = await resolveAccount(userId, input.accountId, undefined);
        patch.accountId = account?.id ?? null;
        if (account) patch.currency = account.currency;
      }
      if (input.categoryId !== undefined) {
        await categories.assertUsable(userId, input.categoryId, 'expense');
        patch.categoryId = input.categoryId;
      }
      // A new due date or frequency restarts the schedule from the next due date.
      if (input.nextDueOn !== undefined || input.frequency !== undefined) {
        const nextDueOn = input.nextDueOn ?? current.nextDueOn;
        patch.nextDueOn = nextDueOn;
        patch.anchorOn = nextDueOn;
      }
      const row = await updateRecurring(db, userId, id, patch);
      if (!row) throw new NotFoundError('Pago recurrente no encontrado');
      return toRecurringPayment(row);
    },

    /**
     * Due dates of active payments from their next (possibly overdue) due
     * date until `days` days from today in the user's time zone.
     */
    async upcoming(
      userId: string,
      days: number = UPCOMING_DAYS.default,
    ): Promise<UpcomingPayment[]> {
      const { timezone } = await settings.load(userId);
      const today = toDateKey(new Date(), timezone);
      const until = addDays(today, days - 1);
      const items: UpcomingPayment[] = [];
      for (const payment of await listRecurring(db, userId)) {
        if (!payment.active) continue;
        const anchor = payment.anchorOn;
        for (const dueOn of occurrencesBetween(
          anchor,
          payment.frequency,
          payment.nextDueOn,
          until,
        )) {
          items.push({
            recurringPaymentId: payment.id,
            name: payment.name,
            dueOn,
            remindOn: addDays(dueOn, -payment.remindDaysBefore),
            amountMinor: payment.amountMinor,
            currency: payment.currency,
            autoCreate: payment.autoCreate,
          });
        }
      }
      return items.sort(
        (a, b) => a.dueOn.localeCompare(b.dueOn) || a.name.localeCompare(b.name, 'es'),
      );
    },

    /**
     * Records the payment of the oldest outstanding due date. If the daily job
     * already created its pending transaction, that one is confirmed (no
     * duplicate); otherwise a confirmed transaction is created and the next
     * due date advances.
     */
    async pay(userId: string, id: string, input: PayRecurring): Promise<RecurringPaymentResult> {
      await requirePayment(userId, id);
      return db.transaction(async (tx) => {
        const payment = await lockRecurring(tx, userId, id);
        if (!payment) throw new NotFoundError('Pago recurrente no encontrado');
        if (!payment.active) throw new BusinessRuleError('El pago recurrente está pausado');

        const pending = await oldestPendingOccurrence(tx, userId, id);
        const accountId = input.accountId ?? pending?.accountId ?? payment.accountId;
        if (!accountId) throw new BusinessRuleError('Elige la cuenta con la que pagaste');
        const account = await accounts.assertUsable(userId, accountId);
        if (account.currency !== payment.currency) {
          throw new BusinessRuleError('La cuenta debe tener la moneda del pago');
        }
        const amountMinor = input.amountMinor ?? pending?.amountMinor ?? payment.amountMinor;
        if (!amountMinor)
          throw new BusinessRuleError('Este pago tiene monto variable: indica el monto');
        const now = new Date();

        if (pending) {
          const confirmed = await confirmTransaction(tx, userId, pending.id, {
            accountId: account.id,
            amountMinor,
            currency: account.currency,
            occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
          });
          if (!confirmed) throw new NotFoundError('Movimiento no encontrado');
          return {
            recurringPayment: toRecurringPayment(payment),
            transaction: toTransaction(confirmed),
          };
        }

        const transaction = await insertTransaction(tx, userId, {
          id: newId(),
          accountId: account.id,
          categoryId: payment.categoryId,
          type: 'expense',
          status: 'confirmed',
          source: 'recurring',
          amountMinor,
          currency: account.currency,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : now,
          merchant: payment.name,
          recurringPaymentId: payment.id,
          confirmedAt: now,
        });
        if (!transaction) throw new Error('Payment insert returned no row');
        const advanced = await updateRecurring(tx, userId, id, {
          nextDueOn: nextDueAfter(payment.anchorOn, payment.frequency, payment.nextDueOn),
        });
        if (!advanced) throw new NotFoundError('Pago recurrente no encontrado');
        return {
          recurringPayment: toRecurringPayment(advanced),
          transaction: toTransaction(transaction),
        };
      });
    },
  };
}

export type RecurringService = ReturnType<typeof createRecurringService>;
