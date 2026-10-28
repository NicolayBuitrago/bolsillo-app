import { getMonthRange, type MonthKey, toMonthKey } from '@bolsillo/core/dates';
import type {
  Budget,
  BudgetSummary,
  createBudgetSchema,
  updateBudgetSchema,
} from '@bolsillo/core/schemas';
import type { Database } from '@bolsillo/db';
import type { z } from 'zod';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../errors';
import { isUniqueViolation } from '../../lib/pg-errors';
import type { CategoriesService } from '../categories/service';
import type { SettingsService } from '../settings/service';
import {
  type BudgetRow,
  budgetSpending,
  findBudget,
  insertBudget,
  listBudgets,
  updateBudget,
} from './repository';

type CreateBudget = z.infer<typeof createBudgetSchema>;
type UpdateBudget = z.infer<typeof updateBudgetSchema>;

const ACTIVE_CATEGORY_KEY = 'budgets_user_category_active_key';

export function toBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    categoryId: row.categoryId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    startsOn: row.startsOn,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Budgets are monthly: any date is stored as the first day of its month. */
const firstDayOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

export interface BudgetsServiceDeps {
  db: Database;
  settings: SettingsService;
  categories: CategoriesService;
}

export function createBudgetsService({ db, settings, categories }: BudgetsServiceDeps) {
  async function requireBudget(userId: string, id: string): Promise<BudgetRow> {
    const row = await findBudget(db, userId, id);
    if (!row) throw new NotFoundError('Presupuesto no encontrado');
    return row;
  }

  return {
    async list(userId: string, includeArchived: boolean): Promise<Budget[]> {
      return (await listBudgets(db, userId, includeArchived)).map(toBudget);
    },

    async create(userId: string, input: CreateBudget): Promise<Budget> {
      // Only active expense categories can have a budget.
      await categories.assertUsable(userId, input.categoryId, 'expense');
      const { defaultCurrency, timezone } = await settings.load(userId);
      const startsOn = firstDayOfMonth(input.startsOn ?? `${toMonthKey(new Date(), timezone)}-01`);
      try {
        const row = await insertBudget(db, userId, {
          categoryId: input.categoryId,
          amountMinor: input.amountMinor,
          currency: input.currency ?? defaultCurrency,
          startsOn,
        });
        if (!row) throw new Error('Budget insert returned no row');
        return toBudget(row);
      } catch (error) {
        if (isUniqueViolation(error, ACTIVE_CATEGORY_KEY)) {
          throw new ConflictError('Ya existe un presupuesto activo para esa categoría');
        }
        throw error;
      }
    },

    async update(userId: string, id: string, input: UpdateBudget): Promise<Budget> {
      const current = await requireBudget(userId, id);
      if (current.archivedAt) throw new BusinessRuleError('El presupuesto está archivado');
      const row = await updateBudget(db, userId, id, {
        amountMinor: input.amountMinor,
        startsOn: input.startsOn ? firstDayOfMonth(input.startsOn) : undefined,
      });
      if (!row) throw new NotFoundError('Presupuesto no encontrado');
      return toBudget(row);
    },

    async archive(userId: string, id: string): Promise<Budget> {
      const current = await requireBudget(userId, id);
      if (current.archivedAt) return toBudget(current);
      const row = await updateBudget(db, userId, id, { archivedAt: new Date() });
      if (!row) throw new NotFoundError('Presupuesto no encontrado');
      return toBudget(row);
    },

    /** Progress of every budget that applies in the month (user's time zone). */
    async summary(userId: string, month: MonthKey): Promise<BudgetSummary> {
      const { timezone } = await settings.load(userId);
      const range = getMonthRange(month, timezone);
      const rows = await budgetSpending(db, userId, { firstDay: `${month}-01`, ...range });
      return {
        month,
        items: rows
          .map(({ budget, categoryName, color, icon, spentMinor }) => ({
            budgetId: budget.id,
            categoryId: budget.categoryId,
            categoryName,
            color,
            icon,
            currency: budget.currency,
            amountMinor: budget.amountMinor,
            spentMinor,
            remainingMinor: budget.amountMinor - spentMinor,
            percent: Math.round((spentMinor / budget.amountMinor) * 100),
          }))
          .sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'es')),
      };
    },
  };
}

export type BudgetsService = ReturnType<typeof createBudgetsService>;
