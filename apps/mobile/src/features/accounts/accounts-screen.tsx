import { useAccounts } from '@bolsillo/api-client';
import type { Account } from '@bolsillo/core/schemas';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AmountText } from '@/components/amount-text';
import { CategoryIcon } from '@/components/category-icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui';
import { accountTypeLabels, accountStrings as t } from './strings';

export function AccountsScreen() {
  const router = useRouter();
  const accounts = useAccounts();

  return (
    <SafeAreaView edges={['top']} className="flex-1">
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
          {t.title}
        </Text>
        <Button label={t.newAccount} onPress={() => router.push('/account-form')} />
      </View>
      {accounts.isPending ? (
        <LoadingState />
      ) : accounts.isError ? (
        <View className="p-4">
          <ErrorState onRetry={() => accounts.refetch()} />
        </View>
      ) : (
        <FlatList
          data={accounts.data}
          keyExtractor={(account) => account.id}
          contentContainerClassName="gap-3 px-4 pb-8"
          refreshControl={
            <RefreshControl
              refreshing={accounts.isRefetching}
              onRefresh={() => void accounts.refetch()}
            />
          }
          ListEmptyComponent={<EmptyState title={t.emptyTitle} description={t.emptyHint} />}
          renderItem={({ item }) => (
            <AccountCard
              account={item}
              onPress={() => router.push({ pathname: '/account-form', params: { id: item.id } })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function AccountCard({ account, onPress }: { account: Account; onPress: () => void }) {
  const isCard = account.type === 'credit_card';
  const details = [
    accountTypeLabels[account.type],
    account.institution,
    account.last4 && `•••• ${account.last4}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="gap-3 rounded-xl border border-border bg-card p-4 active:opacity-80"
    >
      <View className="flex-row items-center gap-3">
        <CategoryIcon icon={account.icon} color={account.color} size={40} />
        <View className="flex-1">
          <Text numberOfLines={1} className="font-semibold text-foreground">
            {account.name}
          </Text>
          <Text numberOfLines={1} className="text-xs text-muted-foreground">
            {details}
          </Text>
        </View>
      </View>
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-xs text-muted-foreground">{isCard ? t.debt : t.balance}</Text>
          <AmountText
            amountMinor={isCard ? Math.max(-account.balanceMinor, 0) : account.balanceMinor}
            currency={account.currency}
            className="text-2xl font-bold"
          />
        </View>
        {isCard && account.creditLimitMinor ? (
          <View className="items-end">
            <Text className="text-xs text-muted-foreground">{t.available}</Text>
            <AmountText
              amountMinor={account.creditLimitMinor + account.balanceMinor}
              currency={account.currency}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
