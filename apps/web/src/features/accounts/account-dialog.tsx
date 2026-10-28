'use client';

import { useCreateAccount, useUpdateAccount } from '@bolsillo/api-client';
import { ICON_KEYS, type IconKey, PALETTE } from '@bolsillo/core/categories';
import {
  CURRENCIES,
  type CurrencyCode,
  DEFAULT_CURRENCY,
  toAmountInput,
  tryParseAmount,
} from '@bolsillo/core/money';
import {
  ACCOUNT_TYPES,
  type Account,
  type AccountType,
  createAccountSchema,
  updateAccountSchema,
} from '@bolsillo/core/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ColorPicker, IconPicker } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { accountTypeLabels, commonStrings } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { accountStrings as t } from './strings';

const ACCOUNT_ICONS: Record<AccountType, IconKey> = {
  bank: 'bank',
  credit_card: 'card',
  cash: 'cash',
  digital_wallet: 'wallet',
  savings: 'savings',
  other: 'other',
};

const optionalAmount = z
  .string()
  .refine((value) => value.trim() === '' || tryParseAmount(value) !== null, t.invalidAmount);

const formSchema = z.object({
  name: z.string().trim().min(1, t.invalidName).max(60),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().max(60),
  last4: z.string().regex(/^(\d{4})?$/, t.invalidLast4),
  currency: z.enum(Object.keys(CURRENCIES) as [CurrencyCode, ...CurrencyCode[]]),
  initialBalance: optionalAmount,
  creditLimit: optionalAmount,
  color: z.string(),
  icon: z.enum(ICON_KEYS),
});

type FormValues = z.infer<typeof formSchema>;

function amountOrZero(text: string, currency: CurrencyCode): number {
  return text.trim() === ''
    ? 0
    : (tryParseAmount(text, { defaultCurrency: currency })?.amountMinor ?? 0);
}

function toFormValues(account: Account | undefined, defaultCurrency: CurrencyCode): FormValues {
  if (!account) {
    return {
      name: '',
      type: 'bank',
      institution: '',
      last4: '',
      currency: defaultCurrency,
      initialBalance: '',
      creditLimit: '',
      color: PALETTE[7],
      icon: 'bank',
    };
  }
  return {
    name: account.name,
    type: account.type,
    institution: account.institution ?? '',
    last4: account.last4 ?? '',
    currency: account.currency,
    initialBalance: toAmountInput(account.initialBalanceMinor, account.currency),
    creditLimit: account.creditLimitMinor
      ? toAmountInput(account.creditLimitMinor, account.currency)
      : '',
    color: account.color ?? PALETTE[7],
    icon: (account.icon as IconKey | null) ?? ACCOUNT_ICONS[account.type],
  };
}

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | undefined;
  defaultCurrency?: CurrencyCode | undefined;
}

export function AccountDialog({
  open,
  onOpenChange,
  account,
  defaultCurrency,
}: AccountDialogProps) {
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: toFormValues(account, defaultCurrency ?? DEFAULT_CURRENCY),
  });
  const { errors, isSubmitting } = form.formState;
  const type = form.watch('type');
  const isCard = type === 'credit_card';

  const onSubmit = form.handleSubmit(async (values) => {
    const initial = amountOrZero(values.initialBalance, values.currency);
    const payload = {
      name: values.name,
      type: values.type,
      institution: values.institution,
      last4: values.last4 || null,
      // Credit cards start with a debt: stored as a negative balance.
      initialBalanceMinor: isCard ? -Math.abs(initial) : initial,
      creditLimitMinor: isCard ? amountOrZero(values.creditLimit, values.currency) || null : null,
      color: values.color,
      icon: values.icon,
    };
    try {
      if (account) {
        await update.mutateAsync({ id: account.id, input: updateAccountSchema.parse(payload) });
        toast.success(t.updated);
      } else {
        await create.mutateAsync(
          createAccountSchema.parse({ ...payload, currency: values.currency }),
        );
        toast.success(t.created);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? t.editAccount : t.newAccount}</DialogTitle>
          {account ? <DialogDescription>{t.currencyLocked}</DialogDescription> : null}
        </DialogHeader>
        <form id="account-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="account-name">{t.name}</FieldLabel>
              <Input
                id="account-name"
                placeholder={t.namePlaceholder}
                aria-invalid={Boolean(errors.name)}
                {...form.register('name')}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="account-type">{t.type}</FieldLabel>
                <NativeSelect
                  id="account-type"
                  className="w-full"
                  {...form.register('type', {
                    onChange: (event) => {
                      if (!form.getFieldState('icon').isDirty) {
                        form.setValue('icon', ACCOUNT_ICONS[event.target.value as AccountType]);
                      }
                    },
                  })}
                >
                  {ACCOUNT_TYPES.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {accountTypeLabels[option]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="account-currency">{t.currency}</FieldLabel>
                <NativeSelect
                  id="account-currency"
                  className="w-full"
                  disabled={account !== undefined}
                  {...form.register('currency')}
                >
                  {Object.keys(CURRENCIES).map((code) => (
                    <NativeSelectOption key={code} value={code}>
                      {code}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="account-institution">{t.institution}</FieldLabel>
                <Input
                  id="account-institution"
                  placeholder={t.institutionPlaceholder}
                  {...form.register('institution')}
                />
              </Field>
              <Field data-invalid={Boolean(errors.last4)}>
                <FieldLabel htmlFor="account-last4">{t.last4}</FieldLabel>
                <Input
                  id="account-last4"
                  inputMode="numeric"
                  maxLength={4}
                  aria-invalid={Boolean(errors.last4)}
                  {...form.register('last4')}
                />
                <FieldError errors={[errors.last4]} />
              </Field>
            </div>
            <FieldDescription>{t.last4Hint}</FieldDescription>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.initialBalance)}>
                <FieldLabel htmlFor="account-initial">
                  {isCard ? t.initialDebt : t.initialBalance}
                </FieldLabel>
                <Input
                  id="account-initial"
                  inputMode="decimal"
                  placeholder="0"
                  className="tabular-nums"
                  aria-invalid={Boolean(errors.initialBalance)}
                  {...form.register('initialBalance')}
                />
                <FieldError errors={[errors.initialBalance]} />
              </Field>
              {isCard ? (
                <Field data-invalid={Boolean(errors.creditLimit)}>
                  <FieldLabel htmlFor="account-limit">{t.creditLimit}</FieldLabel>
                  <Input
                    id="account-limit"
                    inputMode="decimal"
                    placeholder="0"
                    className="tabular-nums"
                    aria-invalid={Boolean(errors.creditLimit)}
                    {...form.register('creditLimit')}
                  />
                  <FieldError errors={[errors.creditLimit]} />
                </Field>
              ) : null}
            </div>
            <ColorPicker
              label={t.color}
              value={form.watch('color')}
              onChange={(color) => form.setValue('color', color, { shouldDirty: true })}
            />
            <IconPicker
              label={t.icon}
              value={form.watch('icon')}
              color={form.watch('color')}
              onChange={(icon) => form.setValue('icon', icon, { shouldDirty: true })}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {commonStrings.cancel}
          </Button>
          <Button type="submit" form="account-form" disabled={isSubmitting}>
            {isSubmitting ? commonStrings.saving : commonStrings.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
