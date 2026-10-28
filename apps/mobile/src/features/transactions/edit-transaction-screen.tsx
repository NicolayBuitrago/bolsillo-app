import {
  ApiError,
  useDeleteTransaction,
  useTransaction,
  useUpdateTransaction,
} from '@bolsillo/api-client';
import { updateTransactionSchema } from '@bolsillo/core/schemas';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui';
import { transactionStrings as t } from './strings';
import { type TransactionDraft, TransactionFlow } from './transaction-flow';
import { useLookups } from './use-lookups';

function showError(error: unknown) {
  Alert.alert(
    'No se pudo guardar',
    error instanceof ApiError ? error.message : 'Revisa tu conexión e intenta de nuevo.',
  );
}

/** Edits need the network: they change data the server already has. */
export function EditTransactionScreen({ id }: { id: string }) {
  const router = useRouter();
  const lookups = useLookups();
  const transaction = useTransaction(id);
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();

  if (transaction.isPending || lookups.isPending) return <LoadingState />;
  if (transaction.isError) {
    return (
      <View className="p-4">
        {transaction.error instanceof ApiError && transaction.error.status === 404 ? (
          <EmptyState title="Este movimiento no existe o fue eliminado." />
        ) : (
          <ErrorState onRetry={() => transaction.refetch()} />
        )}
      </View>
    );
  }

  const item = transaction.data;
  const isTransfer = item.transferGroupId !== null;

  const onSave = async (draft: TransactionDraft) => {
    const input = isTransfer
      ? { amountMinor: draft.amountMinor, occurredAt: draft.occurredAt, note: draft.note }
      : {
          type: draft.type,
          accountId: draft.accountId,
          categoryId: draft.categoryId,
          amountMinor: draft.amountMinor,
          occurredAt: draft.occurredAt,
          merchant: draft.merchant,
          note: draft.note,
        };
    try {
      await update.mutateAsync({ id, input: updateTransactionSchema.parse(input) });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      showError(error);
    }
  };

  const onDelete = () => {
    Alert.alert(
      isTransfer ? t.deleteTransferTitle : t.deleteTitle,
      isTransfer ? t.deleteTransferMessage : t.deleteMessage,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await remove.mutateAsync(id);
              router.back();
            } catch (error) {
              showError(error);
            }
          },
        },
      ],
    );
  };

  return (
    <TransactionFlow
      accounts={lookups.activeAccounts.concat(
        lookups.accounts.filter(
          (account) => account.id === item.accountId && account.archivedAt !== null,
        ),
      )}
      categories={lookups.categoryTree}
      timezone={lookups.timezone}
      transfer={isTransfer}
      initial={{
        type: item.type === 'income' || item.type === 'transfer_in' ? 'income' : 'expense',
        accountId: item.accountId ?? '',
        categoryId: item.categoryId,
        amountMinor: item.amountMinor,
        occurredAt: item.occurredAt,
        merchant: item.merchant ?? '',
        note: item.note ?? '',
      }}
      saving={update.isPending}
      onSave={onSave}
      footer={
        <Button
          label={t.delete}
          variant="destructive"
          onPress={onDelete}
          loading={remove.isPending}
        />
      }
    />
  );
}
