'use client';

import { useAccounts, usePayRecurring } from '@bolsillo/api-client';
import { toAmountInput, tryParseAmount } from '@bolsillo/core/money';
import type { RecurringPayment } from '@bolsillo/core/schemas';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { commonStrings } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { recurringStrings as t } from './strings';

/** Records the payment of the next due date of a recurring payment. */
export function PayDialog({
  payment,
  onOpenChange,
}: {
  payment: RecurringPayment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const accounts = useAccounts();
  const pay = usePayRecurring();
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payment) return;
    setError(null);
    setAmount(payment.amountMinor ? toAmountInput(payment.amountMinor, payment.currency) : '');
    setAccountId(payment.accountId ?? '');
  }, [payment]);

  if (!payment) return null;
  const options = (accounts.data ?? []).filter((account) => account.currency === payment.currency);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = tryParseAmount(amount, { defaultCurrency: payment.currency });
    if (!parsed || parsed.amountMinor <= 0 || parsed.currency !== payment.currency) {
      setError(t.invalidAmount);
      return;
    }
    try {
      await pay.mutateAsync({
        id: payment.id,
        input: { amountMinor: parsed.amountMinor, ...(accountId ? { accountId } : {}) },
      });
      toast.success(t.paid);
      onOpenChange(false);
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t.payTitle} · {payment.name}
          </DialogTitle>
          <DialogDescription>{t.payDescription}</DialogDescription>
        </DialogHeader>
        <form id="pay-form" onSubmit={submit} noValidate>
          <FieldGroup>
            <Field data-invalid={error !== null}>
              <FieldLabel htmlFor="pay-amount">
                {t.amount} ({payment.currency})
              </FieldLabel>
              <Input
                id="pay-amount"
                inputMode="decimal"
                autoFocus
                className="tabular-nums"
                aria-invalid={error !== null}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <FieldError>{error}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="pay-account">{t.account}</FieldLabel>
              <NativeSelect
                id="pay-account"
                className="w-full"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                required
              >
                <NativeSelectOption value="" disabled>
                  {t.noAccount}
                </NativeSelectOption>
                {options.map((account) => (
                  <NativeSelectOption key={account.id} value={account.id}>
                    {account.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {commonStrings.cancel}
          </Button>
          <Button type="submit" form="pay-form" disabled={pay.isPending || !accountId}>
            {pay.isPending ? t.paying : t.pay}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
