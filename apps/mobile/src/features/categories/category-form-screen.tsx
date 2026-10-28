import {
  ApiError,
  useArchiveCategory,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from '@bolsillo/api-client';
import type { IconKey } from '@bolsillo/core/categories';
import {
  type Category,
  type CategoryKind,
  createCategorySchema,
  updateCategorySchema,
} from '@bolsillo/core/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { ColorPicker, IconPicker } from '@/components/pickers';
import { LoadingState } from '@/components/states';
import { Button, Chip, TextField } from '@/components/ui';

function showError(error: unknown) {
  Alert.alert(
    'No se pudo guardar',
    error instanceof ApiError ? error.message : 'Revisa tu conexión.',
  );
}

export function CategoryFormScreen({
  id,
  kind,
}: {
  id?: string | undefined;
  kind?: CategoryKind | undefined;
}) {
  const tree = useCategories();
  if (tree.isPending) return <LoadingState />;
  const all = (tree.data ?? []).flatMap(({ children, ...parent }) => [parent, ...children]);
  const category = id ? all.find((candidate) => candidate.id === id) : undefined;
  const resolvedKind = category?.kind ?? kind ?? 'expense';
  const parents = (tree.data ?? []).filter(
    (node) => node.kind === resolvedKind && !node.isSystem && node.id !== category?.id,
  );
  const hasChildren = (tree.data ?? []).some((node) => node.id === id && node.children.length > 0);
  return (
    <CategoryForm
      key={category?.id ?? 'new'}
      category={category}
      kind={resolvedKind}
      parents={parents}
      canHaveParent={!hasChildren && !category?.isSystem}
    />
  );
}

function CategoryForm({
  category,
  kind,
  parents,
  canHaveParent,
}: {
  category: Category | undefined;
  kind: CategoryKind;
  parents: Category[];
  canHaveParent: boolean;
}) {
  const router = useRouter();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const [name, setName] = useState(category?.name ?? '');
  const [parentId, setParentId] = useState<string | null>(category?.parentId ?? null);
  const [color, setColor] = useState(category?.color ?? '#f97316');
  const [icon, setIcon] = useState<IconKey>((category?.icon as IconKey | null) ?? 'other');
  const [error, setError] = useState<string | null>(null);
  const system = category?.isSystem ?? false;

  const save = async () => {
    if (name.trim() === '') {
      setError('Escribe un nombre');
      return;
    }
    try {
      if (category) {
        const input = system ? { color, icon } : { name, parentId, color, icon };
        await update.mutateAsync({ id: category.id, input: updateCategorySchema.parse(input) });
      } else {
        await create.mutateAsync(createCategorySchema.parse({ name, kind, parentId, color, icon }));
      }
      router.back();
    } catch (reason) {
      showError(reason);
    }
  };

  const confirmArchive = () => {
    if (!category) return;
    Alert.alert(
      '¿Archivar esta categoría?',
      'También se archivan sus subcategorías. Los movimientos conservan la categoría.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await archive.mutateAsync(category.id);
              router.back();
            } catch (reason) {
              showError(reason);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerClassName="gap-5 p-4 pb-12" keyboardShouldPersistTaps="handled">
      <Text className="text-sm text-muted-foreground">
        {system
          ? 'Las categorías de sistema no se pueden renombrar ni archivar.'
          : kind === 'expense'
            ? 'Categoría de gasto'
            : 'Categoría de ingreso'}
      </Text>
      <TextField
        label="Nombre"
        value={name}
        editable={!system}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        maxLength={40}
        error={error}
      />
      {canHaveParent ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Categoría padre</Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip label="Ninguna" selected={parentId === null} onPress={() => setParentId(null)} />
            {parents.map((parent) => (
              <Chip
                key={parent.id}
                label={parent.name}
                selected={parentId === parent.id}
                onPress={() => setParentId(parent.id)}
              />
            ))}
          </View>
        </View>
      ) : null}
      <ColorPicker value={color} onChange={setColor} />
      <IconPicker value={icon} color={color} onChange={setIcon} />
      <Button label="Guardar" loading={create.isPending || update.isPending} onPress={save} />
      {category && !system ? (
        <Button label="Archivar categoría" variant="ghost" onPress={confirmArchive} />
      ) : null}
    </ScrollView>
  );
}
