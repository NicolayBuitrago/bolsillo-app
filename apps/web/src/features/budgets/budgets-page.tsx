'use client';

import {
  useArchiveBudget,
  useBudgetSummary,
  useCategories,
  useCreateBudget,
  useUpdateBudget,
} from '@bolsillo/api-client';
import { flattenCategoryTree } from '@bolsillo/core/categories';
import { toAmountInput, tryParseAmount } from '@bolsillo/core/money';
import type { BudgetSummaryItem } from '@bolsillo/core/schemas';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CategoryIcon } from '@/components/category-icon';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Amount } from '@/components/money/amount';
import { MonthSwitcher, useMonthState } from '@/components/month-switcher';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { commonStrings } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { budgetStrings as t } from './strings';

/** Bar color: normal, warning from 80 %, destructive when overspent. */
function progressColor(percent: number) {
  if (percent > 100) return 'bg-destructive';
  if (percent >= 80) return 'bg-warning';
  return 'bg-primary';
}

export function BudgetsPage() {
  const { month, timezone, setMonth } = useMonthState();
  const summary = useBudgetSummary(month);
  const archive = useArchiveBudget();
  const [dialog, setDialog] = useState<BudgetSummaryItem | 'new' | null>(null);
  const [archiving, setArchiving] = useState<BudgetSummaryItem | null>(null);

  const confirmArchive = async () => {
    if (!archiving) return;
    try {
      await archive.mutateAsync(archiving.budgetId);
      toast.success(t.archived);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setArchiving(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSwitcher month={month} timezone={timezone} onChange={setMonth} />
          <Button onClick={() => setDialog('new')}>
            <Plus data-icon="inline-start" />
            {t.newBudget}
          </Button>
        </div>
      </div>

      {summary.isPending ? (
        <LoadingState rows={4} />
      ) : summary.isError ? (
        <ErrorState onRetry={() => summary.refetch()} />
      ) : summary.data.items.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyHint}
          action={<Button onClick={() => setDialog('new')}>{t.newBudget}</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {summary.data.items.map((item) => (
            <Card key={item.budgetId}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <CategoryIcon icon={item.icon} color={item.color} />
                  <span className="flex-1 truncate font-medium">{item.categoryName}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${commonStrings.actions}: ${item.categoryName}`}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDialog(item)}>
                        {commonStrings.edit}
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setArchiving(item)}>
                        {commonStrings.archive}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div
                  role="progressbar"
                  aria-label={item.categoryName}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(item.percent, 100)}
                  aria-valuetext={`${item.percent} %`}
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={cn('h-full rounded-full', progressColor(item.percent))}
                    style={{ width: `${Math.min(item.percent, 100)}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span>
                    <Amount
                      amountMinor={item.spentMinor}
                      currency={item.currency}
                      className="font-medium"
                    />{' '}
                    <span className="text-muted-foreground">{t.spentOf}</span>{' '}
                    <Amount amountMinor={item.amountMinor} currency={item.currency} />
                    <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                      {item.percent} %
                    </span>
                  </span>
                  <span
                    className={
                      item.remainingMinor < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }
                  >
                    {item.remainingMinor < 0 ? t.overspent : t.remaining}{' '}
                    <Amount amountMinor={Math.abs(item.remainingMinor)} currency={item.currency} />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BudgetDialog target={dialog} month={month} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
        title={t.archiveTitle}
        description={t.archiveDescription}
        confirmLabel={commonStrings.archive}
        pending={archive.isPending}
        onConfirm={confirmArchive}
      />
    </div>
  );
}

function BudgetDialog({
  target,
  month,
  onClose,
}: {
  target: BudgetSummaryItem | 'new' | null;
  month: string | null;
  onClose: () => void;
}) {
  const categories = useCategories();
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const editing = target !== 'new' && target !== null ? target : null;
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [startsMonth, setStartsMonth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const options = flattenCategoryTree(categories.data ?? [], 'expense').filter(
    (option) => !option.isSystem,
  );

  useEffect(() => {
    if (target === null) return;
    setError(null);
    setCategoryId(editing?.categoryId ?? '');
    setAmount(editing ? toAmountInput(editing.amountMinor, editing.currency) : '');
    setStartsMonth(month ?? '');
  }, [target, editing, month]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = tryParseAmount(amount, { defaultCurrency: editing?.currency ?? 'COP' });
    if (!parsed || parsed.amountMinor <= 0) {
      setError(t.invalidAmount);
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.budgetId,
          input: { amountMinor: parsed.amountMinor },
        });
      } else {
        await create.mutateAsync({
          categoryId,
          amountMinor: parsed.amountMinor,
          ...(startsMonth ? { startsOn: `${startsMonth}-01` } : {}),
        });
      }
      toast.success(t.saved);
      onClose();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  };

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? `${t.editBudget} · ${editing.categoryName}` : t.newBudget}
          </DialogTitle>
          <DialogDescription>{t.subcategoriesIncluded}</DialogDescription>
        </DialogHeader>
        <form id="budget-form" onSubmit={submit} noValidate>
          <FieldGroup>
            {editing ? null : (
              <>
                <Field>
                  <FieldLabel htmlFor="budget-category">{t.category}</FieldLabel>
                  <NativeSelect
                    id="budget-category"
                    className="w-full"
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                  >
                    <NativeSelectOption value="" disabled>
                      {t.chooseCategory}
                    </NativeSelectOption>
                    {options.map((option) => (
                      <NativeSelectOption key={option.id} value={option.id}>
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="budget-start">{t.startsMonth}</FieldLabel>
                  <Input
                    id="budget-start"
                    type="month"
                    value={startsMonth}
                    onChange={(event) => setStartsMonth(event.target.value)}
                  />
                </Field>
              </>
            )}
            <Field data-invalid={error !== null}>
              <FieldLabel htmlFor="budget-amount">{t.amount}</FieldLabel>
              <Input
                id="budget-amount"
                inputMode="decimal"
                autoFocus
                className="tabular-nums"
                aria-invalid={error !== null}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {commonStrings.cancel}
          </Button>
          <Button
            type="submit"
            form="budget-form"
            disabled={create.isPending || update.isPending || (!editing && !categoryId)}
          >
            {create.isPending || update.isPending ? commonStrings.saving : commonStrings.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
