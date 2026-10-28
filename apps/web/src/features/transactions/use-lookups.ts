'use client';

import { useAccounts, useCategories, useSettings } from '@bolsillo/api-client';
import { type CategoryOption, flattenCategoryTree } from '@bolsillo/core/categories';
import { DEFAULT_TIME_ZONE } from '@bolsillo/core/dates';
import type { Account } from '@bolsillo/core/schemas';
import { useMemo } from 'react';

/**
 * Accounts and categories by id (archived included, so old transactions still
 * show their names) plus the user's time zone.
 */
export function useLookups() {
  const settings = useSettings();
  const accounts = useAccounts({ includeArchived: true });
  const categories = useCategories({ includeArchived: true });

  return useMemo(() => {
    const accountsById = new Map<string, Account>(
      (accounts.data ?? []).map((account) => [account.id, account]),
    );
    const categoryOptions = flattenCategoryTree(categories.data ?? []);
    const categoriesById = new Map<string, CategoryOption>(
      categoryOptions.map((option) => [option.id, option]),
    );
    return {
      timezone: settings.data?.timezone ?? DEFAULT_TIME_ZONE,
      accounts: accounts.data ?? [],
      activeAccounts: (accounts.data ?? []).filter((account) => account.archivedAt === null),
      accountsById,
      categoryOptions,
      categoriesById,
      isPending: settings.isPending || accounts.isPending || categories.isPending,
    };
  }, [
    settings.data,
    settings.isPending,
    accounts.data,
    accounts.isPending,
    categories.data,
    categories.isPending,
  ]);
}
