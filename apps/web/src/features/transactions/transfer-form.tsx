'use client';

import { useCreateTransfer } from '@bolsillo/api-client';
import { fromLocalDateTime, toLocalDateTime } from '@bolsillo/core/dates';
import { newId } from '@bolsillo/core/ids';
import { tryParseAmount } from '@bolsillo/core/money';
import { createTransferSchema } from '@bolsillo/core/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { commonStrings } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { transactionStrings as t } from './strings';
import { useLookups } from './use-lookups';

const formSchema = z
  .object({
    fromAccountId: z.string().min(1, t.chooseAccount),
    toAccountId: z.string().min(1, t.chooseAccount),
    amount: z.string().refine((value) => {
      const parsed = tryParseAmount(value);
      return parsed !== null && parsed.amountMinor > 0;
    }, t.invalidAmount),
    occurredAt: z.string().min(1, t.invalidDate),
    note: z.string().max(500),
  })
  .refine((values) => values.fromAccountId !== values.toAccountId, {
    message: t.sameAccount,
    path: ['toAccountId'],
  });

type FormValues = z.infer<typeof formSchema>;

export function TransferForm() {
  const router = useRouter();
  const { activeAccounts, accountsById, timezone, isPending } = useLookups();
  const create = useCreateTransfer();
  const [id] = useState(newId);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      fromAccountId: activeAccounts[0]?.id ?? '',
      toAccountId: activeAccounts[1]?.id ?? '',
      amount: '',
      occurredAt: toLocalDateTime(new Date(), timezone),
      note: '',
    },
    resetOptions: { keepDirtyValues: true },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const currency = accountsById.get(values.fromAccountId)?.currency ?? 'COP';
    const parsed = tryParseAmount(values.amount, { defaultCurrency: currency });
    if (!parsed || parsed.currency !== currency) {
      form.setError('amount', { message: t.invalidAmount });
      return;
    }
    try {
      await create.mutateAsync(
        createTransferSchema.parse({
          id,
          fromAccountId: values.fromAccountId,
          toAccountId: values.toAccountId,
          amountMinor: parsed.amountMinor,
          occurredAt: fromLocalDateTime(values.occurredAt, timezone).toISOString(),
          note: values.note,
        }),
      );
      toast.success(t.transferCreated);
      router.push('/transactions');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  if (!isPending && activeAccounts.length < 2) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">{t.transferNeedsAccounts}</p>
        <Link href="/accounts" className={buttonVariants()}>
          {t.createAccount}
        </Link>
      </div>
    );
  }

  const accountOptions = activeAccounts.map((account) => (
    <NativeSelectOption key={account.id} value={account.id}>
      {account.name} · {account.currency}
    </NativeSelectOption>
  ));

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl">
      <FieldGroup>
        <Field data-invalid={Boolean(errors.fromAccountId)}>
          <FieldLabel htmlFor="fromAccountId">{t.fromAccount}</FieldLabel>
          <NativeSelect id="fromAccountId" className="w-full" {...form.register('fromAccountId')}>
            {accountOptions}
          </NativeSelect>
          <FieldError errors={[errors.fromAccountId]} />
        </Field>
        <Field data-invalid={Boolean(errors.toAccountId)}>
          <FieldLabel htmlFor="toAccountId">{t.toAccount}</FieldLabel>
          <NativeSelect
            id="toAccountId"
            className="w-full"
            aria-invalid={Boolean(errors.toAccountId)}
            {...form.register('toAccountId')}
          >
            {accountOptions}
          </NativeSelect>
          <FieldError errors={[errors.toAccountId]} />
        </Field>
        <Field data-invalid={Boolean(errors.amount)}>
          <FieldLabel htmlFor="amount">{t.amount}</FieldLabel>
          <Input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder={t.amountPlaceholder}
            className="h-14 text-3xl font-semibold tabular-nums md:text-3xl"
            aria-invalid={Boolean(errors.amount)}
            {...form.register('amount')}
          />
          <FieldError errors={[errors.amount]} />
        </Field>
        <Field data-invalid={Boolean(errors.occurredAt)}>
          <FieldLabel htmlFor="occurredAt">{t.date}</FieldLabel>
          <Input id="occurredAt" type="datetime-local" {...form.register('occurredAt')} />
          <FieldError errors={[errors.occurredAt]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="note">
            {t.note}{' '}
            <span className="font-normal text-muted-foreground">({commonStrings.optional})</span>
          </FieldLabel>
          <Textarea id="note" rows={2} {...form.register('note')} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? commonStrings.saving : commonStrings.save}
          </Button>
          <Link href="/transactions" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
            {commonStrings.cancel}
          </Link>
        </div>
      </FieldGroup>
    </form>
  );
}
