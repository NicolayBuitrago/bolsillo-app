'use client';

import { useAdjustBalance } from '@bolsillo/api-client';
import { toAmountInput, tryParseAmount } from '@bolsillo/core/money';
import type { Account } from '@bolsillo/core/schemas';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Amount } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { commonStrings } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { accountStrings as t } from './strings';

/** Records an "Ajuste" transaction so the calculated balance matches the real one. */
export function AdjustBalanceDialog({
  account,
  onOpenChange,
}: {
  account: Account | null;
  onOpenChange: (open: boolean) => void;
}) {
  const adjust = useAdjustBalance();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isCard = account?.type === 'credit_card';

  useEffect(() => {
    if (!account) return;
    setError(null);
    // Prefill with what the user would type: the debt for cards, the balance otherwise.
    const shown = account.type === 'credit_card' ? -account.balanceMinor : account.balanceMinor;
    setText(shown >= 0 ? toAmountInput(shown, account.currency) : '');
  }, [account]);

  if (!account) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = tryParseAmount(text, { defaultCurrency: account.currency });
    if (!parsed || parsed.currency !== account.currency) {
      setError(t.invalidAmount);
      return;
    }
    // For cards the user types the debt; the balance is its negative.
    const actualBalanceMinor = isCard ? -parsed.amountMinor : parsed.amountMinor;
    try {
      const result = await adjust.mutateAsync({ id: account.id, input: { actualBalanceMinor } });
      toast.success(result.transaction ? t.adjusted : t.noDifference);
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
            {t.adjustBalance} · {account.name}
          </DialogTitle>
          <DialogDescription>{t.adjustHint}</DialogDescription>
        </DialogHeader>
        <form id="adjust-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t.calculated}:{' '}
            <Amount amountMinor={account.balanceMinor} currency={account.currency} />
          </p>
          <Field data-invalid={error !== null}>
            <FieldLabel htmlFor="actual-balance">
              {isCard ? t.actualDebt : t.actualBalance}
            </FieldLabel>
            <Input
              id="actual-balance"
              inputMode="decimal"
              autoFocus
              className="tabular-nums"
              aria-invalid={error !== null}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <FieldError>{error}</FieldError>
          </Field>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {commonStrings.cancel}
          </Button>
          <Button type="submit" form="adjust-form" disabled={adjust.isPending}>
            {adjust.isPending ? commonStrings.saving : t.adjustBalance}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
