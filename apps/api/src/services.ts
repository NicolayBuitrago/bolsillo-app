import type { Database } from '@bolsillo/db';
import { createAccountsService } from './modules/accounts/service';
import { createBudgetsService } from './modules/budgets/service';
import { createCategoriesService } from './modules/categories/service';
import { createExportService } from './modules/export/service';
import { createRecurringService } from './modules/recurring/service';
import { createReportsService } from './modules/reports/service';
import { createSettingsService } from './modules/settings/service';
import { createTransactionsService } from './modules/transactions/service';
import { createTransfersService } from './modules/transfers/service';

/** Wires the domain services; none of them knows about Hono. */
export function createServices(db: Database) {
  const settings = createSettingsService(db);
  const categories = createCategoriesService(db);
  const accounts = createAccountsService({ db, settings, categories });
  const transactions = createTransactionsService({ db, settings, accounts, categories });
  const transfers = createTransfersService({ db, accounts });
  const reports = createReportsService({ db, settings });
  const budgets = createBudgetsService({ db, settings, categories });
  const recurring = createRecurringService({ db, settings, accounts, categories });
  const exporter = createExportService({ db, settings });
  return {
    settings,
    categories,
    accounts,
    transactions,
    transfers,
    reports,
    budgets,
    recurring,
    exporter,
  };
}

export type Services = ReturnType<typeof createServices>;
