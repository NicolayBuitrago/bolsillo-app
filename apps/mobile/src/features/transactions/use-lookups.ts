import { useAccounts, useCategories, useSettings } from '@bolsillo/api-client';
import { type CategoryOption, flattenCategoryTree } from '@bolsillo/core/categories';
import { DEFAULT_TIME_ZONE } from '@bolsillo/core/dates';
import type { Account } from '@bolsillo/core/schemas';
import { useMemo } from 'react';
import { authClient } from '@/lib/auth-client';

/** Accounts and categories by id (archived included) plus the user's time zone and id. */
export function useLookups() {
  const settings = useSettings();
  const accounts = useAccounts({ includeArchived: true });
  const categories = useCategories({ includeArchived: true });
  const activeCategories = useCategories();
  const { data: session } = authClient.useSession();

  return useMemo(() => {
    const all = accounts.data ?? [];
    const options = flattenCategoryTree(categories.data ?? []);
    return {
      userId: session?.user.id ?? null,
      timezone: settings.data?.timezone ?? DEFAULT_TIME_ZONE,
      accounts: all,
      activeAccounts: all.filter((account) => account.archivedAt === null),
      accountsById: new Map<string, Account>(all.map((account) => [account.id, account])),
      categoryTree: activeCategories.data ?? [],
      categoryOptions: options,
      categoriesById: new Map<string, CategoryOption>(options.map((option) => [option.id, option])),
      isPending: settings.isPending || accounts.isPending || categories.isPending,
      isError: settings.isError || accounts.isError || categories.isError,
      refetch: () => Promise.all([settings.refetch(), accounts.refetch(), categories.refetch()]),
    };
  }, [session, settings, accounts, categories, activeCategories]);
}
