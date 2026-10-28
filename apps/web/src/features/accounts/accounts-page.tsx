'use client';

import { useAccounts, useArchiveAccount, useSettings } from '@bolsillo/api-client';
import type { Account } from '@bolsillo/core/schemas';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CategoryIcon } from '@/components/category-icon';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Amount } from '@/components/money/amount';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { accountTypeLabels, commonStrings } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { AccountDialog } from './account-dialog';
import { AdjustBalanceDialog } from './adjust-balance-dialog';
import { accountStrings as t } from './strings';

export function AccountsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const accounts = useAccounts({ includeArchived: showArchived });
  const settings = useSettings();
  const archive = useArchiveAccount();
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [adjusting, setAdjusting] = useState<Account | null>(null);
  const [archiving, setArchiving] = useState<Account | null>(null);

  const confirmArchive = async () => {
    if (!archiving) return;
    try {
      await archive.mutateAsync(archiving.id);
      toast.success(t.archivedToast);
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
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            {t.showArchived}
          </label>
          <Button onClick={() => setEditing('new')}>
            <Plus data-icon="inline-start" />
            {t.newAccount}
          </Button>
        </div>
      </div>

      {accounts.isPending ? (
        <LoadingState rows={4} />
      ) : accounts.isError ? (
        <ErrorState onRetry={() => accounts.refetch()} />
      ) : accounts.data.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyHint}
          action={<Button onClick={() => setEditing('new')}>{t.newAccount}</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.data.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={() => setEditing(account)}
              onAdjust={() => setAdjusting(account)}
              onArchive={() => setArchiving(account)}
            />
          ))}
        </div>
      )}

      <AccountDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        account={editing === 'new' || editing === null ? undefined : editing}
        defaultCurrency={settings.data?.defaultCurrency}
      />
      <AdjustBalanceDialog
        account={adjusting}
        onOpenChange={(open) => {
          if (!open) setAdjusting(null);
        }}
      />
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

function AccountCard({
  account,
  onEdit,
  onAdjust,
  onArchive,
}: {
  account: Account;
  onEdit: () => void;
  onAdjust: () => void;
  onArchive: () => void;
}) {
  const isCard = account.type === 'credit_card';
  const archived = account.archivedAt !== null;
  const debt = Math.max(-account.balanceMinor, 0);

  return (
    <Card className={archived ? 'opacity-70' : undefined}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <CategoryIcon icon={account.icon} color={account.color} className="size-10" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{account.name}</span>
            <span className="text-xs text-muted-foreground">
              {[
                accountTypeLabels[account.type],
                account.institution,
                account.last4 && `•••• ${account.last4}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          {archived ? <Badge variant="outline">{t.archived}</Badge> : null}
          {archived ? null : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${commonStrings.actions}: ${account.name}`}
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>{commonStrings.edit}</DropdownMenuItem>
                <DropdownMenuItem onClick={onAdjust}>{t.adjustBalance}</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onArchive}>
                  {commonStrings.archive}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{isCard ? t.debt : t.balance}</span>
            <Amount
              amountMinor={isCard ? debt : account.balanceMinor}
              currency={account.currency}
              className="text-2xl font-semibold"
            />
          </div>
          {isCard && account.creditLimitMinor ? (
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">{t.available}</span>
              <Amount
                amountMinor={account.creditLimitMinor + account.balanceMinor}
                currency={account.currency}
              />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
