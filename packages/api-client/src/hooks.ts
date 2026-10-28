import type {
  AdjustBalanceInput,
  CreateAccountInput,
  CreateBudgetInput,
  CreateCategoryInput,
  CreateRecurringPaymentInput,
  CreateTransactionInput,
  CreateTransferInput,
  PayRecurringPaymentInput,
  UpdateAccountInput,
  UpdateBudgetInput,
  UpdateCategoryInput,
  UpdateRecurringPaymentInput,
  UpdateSettingsInput,
  UpdateTransactionInput,
} from '@bolsillo/core/schemas';
import {
  type QueryClient,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { ApiClient } from './client';
import { useApiClient } from './context';
import * as api from './fetchers';
import { queryKeys, type TransactionFilters } from './keys';

const TRANSACTIONS_PAGE_SIZE = 50;

/** After any money movement: lists, balances, reports and budget progress change. */
export function invalidateMoney(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all }),
  ]);
}

// --- Query options (also usable for prefetching) -----------------------------

export const settingsQuery = (client: ApiClient) =>
  queryOptions({ queryKey: queryKeys.settings.all, queryFn: () => api.fetchSettings(client) });

export const accountsQuery = (client: ApiClient, includeArchived = false) =>
  queryOptions({
    queryKey: queryKeys.accounts.list(includeArchived),
    queryFn: () => api.fetchAccounts(client, includeArchived),
  });

export const categoriesQuery = (client: ApiClient, includeArchived = false) =>
  queryOptions({
    queryKey: queryKeys.categories.tree(includeArchived),
    queryFn: () => api.fetchCategories(client, includeArchived),
    staleTime: 5 * 60_000,
  });

export const transactionQuery = (client: ApiClient, id: string) =>
  queryOptions({
    queryKey: queryKeys.transactions.detail(id),
    queryFn: () => api.fetchTransaction(client, id),
  });

export const monthlyReportQuery = (client: ApiClient, month: string) =>
  queryOptions({
    queryKey: queryKeys.reports.monthly(month),
    queryFn: () => api.fetchMonthlyReport(client, month),
  });

// --- Hooks --------------------------------------------------------------------

export function useSettings() {
  return useQuery(settingsQuery(useApiClient()));
}

export function useUpdateSettings() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => api.updateSettings(client, input),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.settings.all, settings);
      // The time zone changes month boundaries.
      return queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
  });
}

export function useAccounts(options: { includeArchived?: boolean } = {}) {
  return useQuery(accountsQuery(useApiClient(), options.includeArchived ?? false));
}

export function useCreateAccount() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => api.createAccount(client, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }),
  });
}

export function useUpdateAccount() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccountInput }) =>
      api.updateAccount(client, id, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
      ]),
  });
}

export function useArchiveAccount() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.archiveAccount(client, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }),
  });
}

export function useAdjustBalance() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdjustBalanceInput }) =>
      api.adjustAccountBalance(client, id, input),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useCategories(options: { includeArchived?: boolean } = {}) {
  return useQuery(categoriesQuery(useApiClient(), options.includeArchived ?? false));
}

function useCategoryMutation<Input>(mutate: (client: ApiClient, input: Input) => Promise<unknown>) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => mutate(client, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
      ]),
  });
}

export function useCreateCategory() {
  return useCategoryMutation((client, input: CreateCategoryInput) =>
    api.createCategory(client, input),
  );
}

export function useUpdateCategory() {
  return useCategoryMutation((client, { id, input }: { id: string; input: UpdateCategoryInput }) =>
    api.updateCategory(client, id, input),
  );
}

export function useArchiveCategory() {
  return useCategoryMutation((client, id: string) => api.archiveCategory(client, id));
}

/** Paged transaction list (newest first). `fetchNextPage` follows the cursor. */
export function useTransactions(filters: TransactionFilters = {}) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: ({ pageParam }) =>
      api.fetchTransactions(client, filters, { cursor: pageParam, limit: TRANSACTIONS_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useTransaction(id: string) {
  return useQuery(transactionQuery(useApiClient(), id));
}

export function useCreateTransaction() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => api.createTransaction(client, input),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useUpdateTransaction() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTransactionInput }) =>
      api.updateTransaction(client, id, input),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useDeleteTransaction() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTransaction(client, id),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useCreateTransfer() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransferInput) => api.createTransfer(client, input),
    onSuccess: () => invalidateMoney(queryClient),
  });
}

/** `null` while the month is unknown (e.g. before the user's time zone loads). */
export function useMonthlyReport(month: string | null) {
  const client = useApiClient();
  return useQuery({ ...monthlyReportQuery(client, month ?? ''), enabled: month !== null });
}

export function useTrend(months = 6) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.reports.trend(months),
    queryFn: () => api.fetchTrend(client, months),
  });
}

export function useBudgets(options: { includeArchived?: boolean } = {}) {
  const client = useApiClient();
  const includeArchived = options.includeArchived ?? false;
  return useQuery({
    queryKey: queryKeys.budgets.list(includeArchived),
    queryFn: () => api.fetchBudgets(client, includeArchived),
  });
}

/** `null` while the month is unknown. */
export function useBudgetSummary(month: string | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.budgets.summary(month ?? ''),
    queryFn: () => api.fetchBudgetSummary(client, month ?? ''),
    enabled: month !== null,
  });
}

function useBudgetMutation<Input>(mutate: (client: ApiClient, input: Input) => Promise<unknown>) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => mutate(client, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all }),
  });
}

export function useCreateBudget() {
  return useBudgetMutation((client, input: CreateBudgetInput) => api.createBudget(client, input));
}

export function useUpdateBudget() {
  return useBudgetMutation((client, { id, input }: { id: string; input: UpdateBudgetInput }) =>
    api.updateBudget(client, id, input),
  );
}

export function useArchiveBudget() {
  return useBudgetMutation((client, id: string) => api.archiveBudget(client, id));
}

export function useRecurringPayments() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.recurring.list(),
    queryFn: () => api.fetchRecurring(client),
  });
}

export const upcomingQuery = (client: ApiClient, days: number) =>
  queryOptions({
    queryKey: queryKeys.recurring.upcoming(days),
    queryFn: () => api.fetchUpcoming(client, days),
  });

export function useUpcomingPayments(days = 30) {
  return useQuery(upcomingQuery(useApiClient(), days));
}

function useRecurringMutation<Input>(
  mutate: (client: ApiClient, input: Input) => Promise<unknown>,
) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => mutate(client, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all }),
  });
}

export function useCreateRecurring() {
  return useRecurringMutation((client, input: CreateRecurringPaymentInput) =>
    api.createRecurring(client, input),
  );
}

export function useUpdateRecurring() {
  return useRecurringMutation(
    (client, { id, input }: { id: string; input: UpdateRecurringPaymentInput }) =>
      api.updateRecurring(client, id, input),
  );
}

/** Paying creates or confirms a transaction: money queries change too. */
export function usePayRecurring() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PayRecurringPaymentInput }) =>
      api.payRecurring(client, id, input),
    onSuccess: () =>
      Promise.all([
        invalidateMoney(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all }),
      ]),
  });
}
