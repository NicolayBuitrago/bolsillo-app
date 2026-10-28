import type { ListTransactionsQuery } from '@bolsillo/core/schemas';

/** Transaction list filters as the UIs build them (paging is handled by the hook). */
export type TransactionFilters = Omit<ListTransactionsQuery, 'cursor' | 'limit'>;

/**
 * Query keys. Every key starts with its resource name so a mutation can
 * invalidate a whole resource with `{ queryKey: queryKeys.<resource>.all }`.
 */
export const queryKeys = {
  settings: { all: ['settings'] as const },
  accounts: {
    all: ['accounts'] as const,
    list: (includeArchived: boolean) => ['accounts', 'list', { includeArchived }] as const,
  },
  categories: {
    all: ['categories'] as const,
    tree: (includeArchived: boolean) => ['categories', 'tree', { includeArchived }] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    list: (filters: TransactionFilters) => ['transactions', 'list', filters] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
  },
  reports: {
    all: ['reports'] as const,
    monthly: (month: string) => ['reports', 'monthly', month] as const,
    trend: (months: number) => ['reports', 'trend', months] as const,
  },
  budgets: {
    all: ['budgets'] as const,
    list: (includeArchived: boolean) => ['budgets', 'list', { includeArchived }] as const,
    summary: (month: string) => ['budgets', 'summary', month] as const,
  },
  recurring: {
    all: ['recurring'] as const,
    list: () => ['recurring', 'list'] as const,
    upcoming: (days: number) => ['recurring', 'upcoming', days] as const,
  },
};
