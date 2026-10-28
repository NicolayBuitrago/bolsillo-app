'use client';

import {
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from '@bolsillo/api-client';
import { flattenCategoryTree } from '@bolsillo/core/categories';
import { fromLocalDateTime, toLocalDateTime } from '@bolsillo/core/dates';
import { newId } from '@bolsillo/core/ids';
import { toAmountInput, tryParseAmount } from '@bolsillo/core/money';
import {
  createTransactionSchema,
  type EntryType,
  type Transaction,
  updateTransactionSchema,
} from '@bolsillo/core/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { commonStrings } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { transactionStrings as t } from './strings';
import { useLookups } from './use-lookups';

const LAST_ACCOUNT_KEY = 'bolsillo.lastAccountId';

const formSchema = z.object({
  type: z.enum(['expense', 'income']),
  amount: z.string().refine((value) => {
    const parsed = tryParseAmount(value);
    return parsed !== null && parsed.amountMinor > 0;
  }, t.invalidAmount),
  accountId: z.string().min(1, t.chooseAccount),
  categoryId: z.string(),
  occurredAt: z.string().min(1, t.invalidDate),
  merchant: z.string().max(120),
  note: z.string().max(500),
});

type FormValues = z.infer<typeof formSchema>;

function readLastAccount(): string | null {
  try {
    return window.localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function rememberAccount(accountId: string) {
  try {
    window.localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
  } catch {
    // Storage may be unavailable (private mode); remembering is optional.
  }
}

/** New or edit form for an expense or income. Transfer rows only edit amount, date and note. */
export function TransactionForm({ transaction }: { transaction?: Transaction }) {
  const router = useRouter();
  const lookups = useLookups();
  const categories = useCategories();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  // One id per form: a double submit or a retry is idempotent on the API.
  const [id] = useState(() => transaction?.id ?? newId());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEdit = transaction !== undefined;
  const isTransfer = transaction?.transferGroupId != null;
  const { timezone, activeAccounts } = lookups;

  const defaultAccountId = useMemo(() => {
    if (transaction?.accountId) return transaction.accountId;
    const last = typeof window === 'undefined' ? null : readLastAccount();
    return activeAccounts.find((account) => account.id === last)?.id ?? activeAccounts[0]?.id ?? '';
  }, [transaction, activeAccounts]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      type: (transaction?.type === 'income' ? 'income' : 'expense') as EntryType,
      amount: transaction ? toAmountInput(transaction.amountMinor, transaction.currency) : '',
      accountId: defaultAccountId,
      categoryId: transaction?.categoryId ?? '',
      occurredAt: toLocalDateTime(
        transaction ? new Date(transaction.occurredAt) : new Date(),
        timezone,
      ),
      merchant: transaction?.merchant ?? '',
      note: transaction?.note ?? '',
    },
    resetOptions: { keepDirtyValues: true },
  });
  const { errors, isSubmitting } = form.formState;
  const type = form.watch('type');
  const accountId = form.watch('accountId');
  const account = lookups.accountsById.get(accountId);

  const categoryGroups = useMemo(() => {
    const options = flattenCategoryTree(categories.data ?? [], type);
    const groups = new Map<string, typeof options>();
    for (const option of options) {
      const group = option.parentName ?? option.name;
      groups.set(group, [...(groups.get(group) ?? []), option]);
    }
    return [...groups.entries()];
  }, [categories.data, type]);

  const onSubmit = form.handleSubmit(async (values) => {
    const currency = account?.currency ?? transaction?.currency ?? 'COP';
    const parsed = tryParseAmount(values.amount, { defaultCurrency: currency });
    if (!parsed || parsed.currency !== currency) {
      form.setError('amount', { message: t.invalidAmount });
      return;
    }
    const occurredAt = fromLocalDateTime(values.occurredAt, timezone).toISOString();
    try {
      if (isTransfer && transaction) {
        await update.mutateAsync({
          id: transaction.id,
          input: updateTransactionSchema.parse({
            amountMinor: parsed.amountMinor,
            occurredAt,
            note: values.note,
          }),
        });
      } else {
        const payload = {
          type: values.type,
          accountId: values.accountId,
          categoryId: values.categoryId || null,
          amountMinor: parsed.amountMinor,
          occurredAt,
          merchant: values.merchant,
          note: values.note,
        };
        if (transaction) {
          await update.mutateAsync({
            id: transaction.id,
            input: updateTransactionSchema.parse(payload),
          });
        } else {
          await create.mutateAsync(createTransactionSchema.parse({ id, ...payload }));
          rememberAccount(values.accountId);
        }
      }
      toast.success(isEdit ? t.updated : t.created);
      router.push('/transactions');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  const onDelete = async () => {
    if (!transaction) return;
    try {
      await remove.mutateAsync(transaction.id);
      toast.success(t.deleted);
      router.push('/transactions');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setConfirmDelete(false);
    }
  };

  if (!isEdit && !lookups.isPending && activeAccounts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">{t.noAccounts}</p>
        <Link href="/accounts" className={buttonVariants()}>
          {t.createAccount}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl">
      <FieldGroup>
        {isTransfer ? (
          <FieldDescription>{t.transferEditHint}</FieldDescription>
        ) : (
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <fieldset className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                <legend className="sr-only">{t.type}</legend>
                {(['expense', 'income'] as const).map((option) => (
                  <label
                    key={option}
                    className={cn(
                      'flex min-h-10 cursor-pointer items-center justify-center rounded-md text-sm font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                      field.value === option && 'bg-background shadow-sm',
                    )}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={field.name}
                      value={option}
                      checked={field.value === option}
                      onChange={() => {
                        field.onChange(option);
                        form.setValue('categoryId', '');
                      }}
                    />
                    {option === 'expense' ? t.expense : t.income}
                  </label>
                ))}
              </fieldset>
            )}
          />
        )}

        <Field data-invalid={Boolean(errors.amount)}>
          <FieldLabel htmlFor="amount">
            {t.amount}
            {account ? ` (${account.currency})` : ''}
          </FieldLabel>
          <Input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            autoFocus={!isEdit}
            placeholder={t.amountPlaceholder}
            className="h-14 text-3xl font-semibold tabular-nums md:text-3xl"
            aria-invalid={Boolean(errors.amount)}
            aria-describedby="amount-hint"
            {...form.register('amount')}
          />
          <FieldDescription id="amount-hint">{t.amountHint}</FieldDescription>
          <FieldError errors={[errors.amount]} />
        </Field>

        {isTransfer ? null : (
          <>
            <Field>
              <FieldLabel htmlFor="categoryId">{t.category}</FieldLabel>
              <NativeSelect id="categoryId" className="w-full" {...form.register('categoryId')}>
                <NativeSelectOption value="">{commonStrings.noCategory}</NativeSelectOption>
                {categoryGroups.map(([group, options]) => (
                  <NativeSelectOptGroup key={group} label={group}>
                    {options.map((option) => (
                      <NativeSelectOption key={option.id} value={option.id}>
                        {option.parentName ? option.name : `${option.name} (general)`}
                      </NativeSelectOption>
                    ))}
                  </NativeSelectOptGroup>
                ))}
              </NativeSelect>
            </Field>

            <Field data-invalid={Boolean(errors.accountId)}>
              <FieldLabel htmlFor="accountId">{t.account}</FieldLabel>
              <NativeSelect
                id="accountId"
                className="w-full"
                aria-invalid={Boolean(errors.accountId)}
                {...form.register('accountId')}
              >
                {activeAccounts.map((option) => (
                  <NativeSelectOption key={option.id} value={option.id}>
                    {option.name} · {option.currency}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError errors={[errors.accountId]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="merchant">
                {t.merchant}{' '}
                <span className="font-normal text-muted-foreground">
                  ({commonStrings.optional})
                </span>
              </FieldLabel>
              <Input
                id="merchant"
                placeholder={t.merchantPlaceholder}
                {...form.register('merchant')}
              />
            </Field>
          </>
        )}

        <Field data-invalid={Boolean(errors.occurredAt)}>
          <FieldLabel htmlFor="occurredAt">{t.date}</FieldLabel>
          <Input
            id="occurredAt"
            type="datetime-local"
            aria-invalid={Boolean(errors.occurredAt)}
            {...form.register('occurredAt')}
          />
          <FieldError errors={[errors.occurredAt]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="note">
            {t.note}{' '}
            <span className="font-normal text-muted-foreground">({commonStrings.optional})</span>
          </FieldLabel>
          <Textarea id="note" rows={2} {...form.register('note')} />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? commonStrings.saving : commonStrings.save}
          </Button>
          <Link href="/transactions" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
            {commonStrings.cancel}
          </Link>
          {isEdit ? (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="ml-auto"
              onClick={() => setConfirmDelete(true)}
            >
              {commonStrings.delete}
            </Button>
          ) : null}
        </div>
      </FieldGroup>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={isTransfer ? t.deleteTransferTitle : t.deleteTitle}
        description={isTransfer ? t.deleteTransferDescription : t.deleteDescription}
        confirmLabel={commonStrings.delete}
        pending={remove.isPending}
        onConfirm={onDelete}
      />
    </form>
  );
}
