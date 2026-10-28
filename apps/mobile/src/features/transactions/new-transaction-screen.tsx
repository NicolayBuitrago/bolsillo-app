import { newId } from '@bolsillo/core/ids';
import { createTransactionSchema } from '@bolsillo/core/schemas';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { useQueueTransaction } from '@/features/sync/outbox-provider';
import { transactionStrings as t } from './strings';
import { type TransactionDraft, TransactionFlow } from './transaction-flow';
import { useLookups } from './use-lookups';

/**
 * New expense or income. It is saved through the outbox, so it works without
 * network and is sent once when the connection returns.
 */
export function NewTransactionScreen() {
  const router = useRouter();
  const lookups = useLookups();
  const queue = useQueueTransaction();
  // One id for this screen: saving twice cannot create two transactions.
  const [id] = useState(newId);
  const [saving, setSaving] = useState(false);

  if (lookups.isPending) return <LoadingState />;
  if (lookups.isError && lookups.accounts.length === 0) {
    return (
      <View className="p-4">
        <ErrorState onRetry={() => lookups.refetch()} />
      </View>
    );
  }
  if (lookups.activeAccounts.length === 0) {
    return (
      <View className="p-4">
        <EmptyState title={t.noAccounts} />
      </View>
    );
  }

  const onSave = async (draft: TransactionDraft) => {
    setSaving(true);
    try {
      const { synced } = await queue(
        createTransactionSchema.parse({
          id,
          type: draft.type,
          accountId: draft.accountId,
          categoryId: draft.categoryId,
          amountMinor: draft.amountMinor,
          occurredAt: draft.occurredAt,
          merchant: draft.merchant,
          note: draft.note,
        }),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!synced) Alert.alert(t.unsynced, t.savedOffline);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <TransactionFlow
      accounts={lookups.activeAccounts}
      categories={lookups.categoryTree}
      timezone={lookups.timezone}
      saving={saving}
      onSave={onSave}
    />
  );
}
