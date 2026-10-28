import { useCategories } from '@bolsillo/api-client';
import type { Category, CategoryKind } from '@bolsillo/core/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { CategoryIcon } from '@/components/category-icon';
import { ErrorState, LoadingState } from '@/components/states';
import { Button, Segmented } from '@/components/ui';

interface Row {
  category: Category;
  child: boolean;
}

export function CategoriesScreen() {
  const router = useRouter();
  const tree = useCategories();
  const [kind, setKind] = useState<CategoryKind>('expense');

  if (tree.isPending) return <LoadingState />;
  if (tree.isError) {
    return (
      <View className="p-4">
        <ErrorState onRetry={() => tree.refetch()} />
      </View>
    );
  }

  const sections = tree.data
    .filter((node) => node.kind === kind)
    .map(({ children, ...parent }) => ({
      key: parent.id,
      data: [
        { category: parent, child: false },
        ...children.map((child) => ({ category: child, child: true })),
      ] satisfies Row[],
    }));

  return (
    <SectionList
      sections={sections}
      keyExtractor={(row) => row.category.id}
      contentContainerClassName="gap-1 p-4 pb-12"
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View className="gap-3 pb-2">
          <Segmented
            options={[
              { value: 'expense', label: 'Gastos' },
              { value: 'income', label: 'Ingresos' },
            ]}
            value={kind}
            onChange={setKind}
          />
          <Button
            label="Nueva categoría"
            variant="outline"
            onPress={() => router.push({ pathname: '/category-form', params: { kind } })}
          />
        </View>
      }
      renderSectionFooter={() => <View className="h-2" />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            item.category.isSystem ? `${item.category.name}, sistema` : item.category.name
          }
          onPress={() =>
            router.push({ pathname: '/category-form', params: { id: item.category.id } })
          }
          className={`min-h-14 flex-row items-center gap-3 rounded-lg px-2 active:bg-muted ${item.child ? 'ml-10' : ''}`}
        >
          <CategoryIcon
            icon={item.category.icon}
            color={item.category.color}
            size={item.child ? 30 : 36}
          />
          <Text className={`flex-1 text-foreground ${item.child ? '' : 'font-semibold'}`}>
            {item.category.name}
          </Text>
          {item.category.isSystem ? (
            <Text className="text-xs text-muted-foreground">Sistema</Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}
