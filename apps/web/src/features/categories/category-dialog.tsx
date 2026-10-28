'use client';

import { useCategories, useCreateCategory, useUpdateCategory } from '@bolsillo/api-client';
import { ICON_KEYS, type IconKey, PALETTE } from '@bolsillo/core/categories';
import {
  type Category,
  type CategoryKind,
  createCategorySchema,
  updateCategorySchema,
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { commonStrings } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { categoryStrings as t } from './strings';

const formSchema = z.object({
  name: z.string().trim().min(1, t.invalidName).max(40),
  parentId: z.string(),
  color: z.string(),
  icon: z.enum(ICON_KEYS),
});

type FormValues = z.infer<typeof formSchema>;

export type CategoryDialogTarget =
  | { mode: 'create'; kind: CategoryKind; parentId?: string }
  | { mode: 'edit'; category: Category };

export function CategoryDialog({
  target,
  onOpenChange,
}: {
  target: CategoryDialogTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const tree = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const editing = target?.mode === 'edit' ? target.category : undefined;
  const kind = target?.mode === 'edit' ? target.category.kind : (target?.kind ?? 'expense');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      name: editing?.name ?? '',
      parentId: editing?.parentId ?? (target?.mode === 'create' ? (target.parentId ?? '') : ''),
      color: editing?.color ?? PALETTE[0],
      icon: (editing?.icon as IconKey | null) ?? 'other',
    },
  });
  const { errors, isSubmitting } = form.formState;

  // Valid parents: active top-level, same kind, not system, not itself.
  const parents = (tree.data ?? []).filter(
    (node) => node.kind === kind && !node.isSystem && node.id !== editing?.id,
  );
  const hasChildren = editing
    ? (tree.data ?? []).some((node) => node.id === editing.id && node.children.length > 0)
    : false;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        const input = editing.isSystem
          ? { color: values.color, icon: values.icon }
          : {
              name: values.name,
              parentId: values.parentId || null,
              color: values.color,
              icon: values.icon,
            };
        await update.mutateAsync({ id: editing.id, input: updateCategorySchema.parse(input) });
        toast.success(t.updated);
      } else {
        await create.mutateAsync(
          createCategorySchema.parse({
            name: values.name,
            kind,
            parentId: values.parentId || null,
            color: values.color,
            icon: values.icon,
          }),
        );
        toast.success(t.created);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t.editCategory : t.newCategory}</DialogTitle>
          <DialogDescription>
            {editing?.isSystem ? t.systemHint : kind === 'expense' ? t.expenses : t.income}
          </DialogDescription>
        </DialogHeader>
        <form id="category-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="category-name">{t.name}</FieldLabel>
              <Input
                id="category-name"
                disabled={editing?.isSystem}
                aria-invalid={Boolean(errors.name)}
                {...form.register('name')}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            {editing?.isSystem || hasChildren ? null : (
              <Field>
                <FieldLabel htmlFor="category-parent">{t.parent}</FieldLabel>
                <NativeSelect
                  id="category-parent"
                  className="w-full"
                  {...form.register('parentId')}
                >
                  <NativeSelectOption value="">{t.noParent}</NativeSelectOption>
                  {parents.map((parent) => (
                    <NativeSelectOption key={parent.id} value={parent.id}>
                      {parent.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
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
          <Button type="submit" form="category-form" disabled={isSubmitting}>
            {isSubmitting ? commonStrings.saving : commonStrings.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
