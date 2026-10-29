'use client';

import {
  useAccounts,
  useCategories,
  useCreateRecurring,
  useSettings,
  useUpdateRecurring,
} from '@bolsillo/api-client';
import { flattenCategoryTree } from '@bolsillo/core/categories';
import { DEFAULT_TIME_ZONE, toDateKey } from '@bolsillo/core/dates';
import { toAmountInput, tryParseAmount } from '@bolsillo/core/money';
import { RECURRENCE_FREQUENCIES } from '@bolsillo/core/recurring';
import {
  createRecurringPaymentSchema,
  type RecurringPayment,
  updateRecurringPaymentSchema,
} from '@bolsillo/core/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { commonStrings, frequencyLabels } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { recurringStrings as t } from './strings';

const formSchema = z.object({
  name: z.string().trim().min(1, t.invalidName).max(60),
  amount: z
    .string()
    .refine(
      (value) => value.trim() === '' || (tryParseAmount(value)?.amountMinor ?? 0) > 0,
      t.invalidAmount,
    ),
  accountId: z.string(),
  categoryId: z.string(),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  dueOn: z.iso.date(t.invalidDate),
  remindDaysBefore: z.coerce.number<string>().int().min(0).max(30),
  autoCreate: z.boolean(),
});

type FormValues = z.input<typeof formSchema>;

export function RecurringDialog({
  open,
  payment,
  onOpenChange,
}: {
  open: boolean;
  payment?: RecurringPayment | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const accounts = useAccounts();
  const categories = useCategories();
  const settings = useSettings();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();
  const timezone = settings.data?.timezone ?? DEFAULT_TIME_ZONE;

  const form = useForm<FormValues, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      name: payment?.name ?? '',
      amount: payment?.amountMinor ? toAmountInput(payment.amountMinor, payment.currency) : '',
      accountId: payment?.accountId ?? '',
      categoryId: payment?.categoryId ?? '',
      frequency: payment?.frequency ?? 'monthly',
      dueOn: payment?.nextDueOn ?? toDateKey(new Date(), timezone),
      remindDaysBefore: String(payment?.remindDaysBefore ?? 2),
      autoCreate: payment?.autoCreate ?? false,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const hasAmount = (form.watch('amount') ?? '').trim() !== '';
  const options = flattenCategoryTree(categories.data ?? [], 'expense');

  const onSubmit = form.handleSubmit(async (values) => {
    const account = accounts.data?.find((candidate) => candidate.id === values.accountId);
    const currency =
      account?.currency ?? payment?.currency ?? settings.data?.defaultCurrency ?? 'COP';
    const amountMinor =
      values.amount.trim() === ''
        ? null
        : (tryParseAmount(values.amount, { defaultCurrency: currency })?.amountMinor ?? null);
    const shared = {
      name: values.name,
      amountMinor,
      accountId: values.accountId || null,
      categoryId: values.categoryId || null,
      frequency: values.frequency,
      remindDaysBefore: values.remindDaysBefore,
      autoCreate: amountMinor !== null && values.autoCreate,
    };
    try {
      if (payment) {
        await update.mutateAsync({
          id: payment.id,
          input: updateRecurringPaymentSchema.parse({
            ...shared,
            ...(values.dueOn !== payment.nextDueOn ? { nextDueOn: values.dueOn } : {}),
            ...(values.frequency === payment.frequency ? { frequency: undefined } : {}),
          }),
        });
      } else {
        await create.mutateAsync(
          createRecurringPaymentSchema.parse({ ...shared, firstDueOn: values.dueOn }),
        );
      }
      toast.success(t.saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{payment ? t.editPayment : t.newPayment}</DialogTitle>
        </DialogHeader>
        <form id="recurring-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="recurring-name">{t.name}</FieldLabel>
              <Input
                id="recurring-name"
                placeholder={t.namePlaceholder}
                aria-invalid={Boolean(errors.name)}
                {...form.register('name')}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.amount)}>
              <FieldLabel htmlFor="recurring-amount">{t.amount}</FieldLabel>
              <Input
                id="recurring-amount"
                inputMode="decimal"
                className="tabular-nums"
                aria-invalid={Boolean(errors.amount)}
                {...form.register('amount')}
              />
              <FieldDescription>{t.amountHint}</FieldDescription>
              <FieldError errors={[errors.amount]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="recurring-frequency">{t.frequency}</FieldLabel>
                <NativeSelect
                  id="recurring-frequency"
                  className="w-full"
                  {...form.register('frequency')}
                >
                  {RECURRENCE_FREQUENCIES.map((frequency) => (
                    <NativeSelectOption key={frequency} value={frequency}>
                      {frequencyLabels[frequency]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field data-invalid={Boolean(errors.dueOn)}>
                <FieldLabel htmlFor="recurring-due">{payment ? t.nextDue : t.firstDue}</FieldLabel>
                <Input id="recurring-due" type="date" {...form.register('dueOn')} />
                <FieldError errors={[errors.dueOn]} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="recurring-account">{t.account}</FieldLabel>
                <NativeSelect
                  id="recurring-account"
                  className="w-full"
                  {...form.register('accountId')}
                >
                  <NativeSelectOption value="">{t.noAccount}</NativeSelectOption>
                  {(accounts.data ?? []).map((account) => (
                    <NativeSelectOption key={account.id} value={account.id}>
                      {account.name} · {account.currency}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="recurring-category">{t.category}</FieldLabel>
                <NativeSelect
                  id="recurring-category"
                  className="w-full"
                  {...form.register('categoryId')}
                >
                  <NativeSelectOption value="">{commonStrings.noCategory}</NativeSelectOption>
                  {options.map((option) => (
                    <NativeSelectOption key={option.id} value={option.id}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field data-invalid={Boolean(errors.remindDaysBefore)}>
              <FieldLabel htmlFor="recurring-remind">{t.remindDays}</FieldLabel>
              <Input
                id="recurring-remind"
                type="number"
                min={0}
                max={30}
                className="w-24"
                {...form.register('remindDaysBefore')}
              />
              <FieldError errors={[errors.remindDaysBefore]} />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                disabled={!hasAmount}
                {...form.register('autoCreate')}
              />
              <span>
                {t.autoCreate}
                {hasAmount ? null : (
                  <span className="block text-xs text-muted-foreground">
                    {t.autoCreateNeedsAmount}
                  </span>
                )}
              </span>
            </label>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {commonStrings.cancel}
          </Button>
          <Button type="submit" form="recurring-form" disabled={isSubmitting}>
            {isSubmitting ? commonStrings.saving : commonStrings.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
