'use client';

import { useArchiveCategory, useCategories } from '@bolsillo/api-client';
import type { Category, CategoryKind, CategoryTreeNode } from '@bolsillo/core/schemas';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CategoryIcon } from '@/components/category-icon';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { commonStrings } from '@/features/shared/strings';
import { errorMessage } from '@/lib/errors';
import { CategoryDialog, type CategoryDialogTarget } from './category-dialog';
import { categoryStrings as t } from './strings';

export function CategoriesPage() {
  const [showArchived, setShowArchived] = useState(false);
  const tree = useCategories({ includeArchived: showArchived });
  const archive = useArchiveCategory();
  const [dialog, setDialog] = useState<CategoryDialogTarget | null>(null);
  const [archiving, setArchiving] = useState<Category | null>(null);

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

  const section = (kind: CategoryKind) => (
    <CategorySection
      title={kind === 'expense' ? t.expenses : t.income}
      nodes={(tree.data ?? []).filter((node) => node.kind === kind)}
      onCreate={() => setDialog({ mode: 'create', kind })}
      onCreateChild={(parent) => setDialog({ mode: 'create', kind, parentId: parent.id })}
      onEdit={(category) => setDialog({ mode: 'edit', category })}
      onArchive={setArchiving}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          {t.showArchived}
        </label>
      </div>
      {tree.isPending ? (
        <LoadingState rows={6} />
      ) : tree.isError ? (
        <ErrorState onRetry={() => tree.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {section('expense')}
          {section('income')}
        </div>
      )}
      <CategoryDialog
        target={dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
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

interface SectionProps {
  title: string;
  nodes: CategoryTreeNode[];
  onCreate: () => void;
  onCreateChild: (parent: Category) => void;
  onEdit: (category: Category) => void;
  onArchive: (category: Category) => void;
}

function CategorySection({
  title,
  nodes,
  onCreate,
  onCreateChild,
  onEdit,
  onArchive,
}: SectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={onCreate}>
          <Plus data-icon="inline-start" />
          {t.newCategory}
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {nodes.map((node) => (
            <li key={node.id} className="py-2">
              <CategoryRow
                category={node}
                onEdit={onEdit}
                onArchive={onArchive}
                onCreateChild={node.isSystem ? undefined : () => onCreateChild(node)}
              />
              {node.children.length > 0 ? (
                <ul className="mt-1 ml-11 flex flex-col">
                  {node.children.map((child) => (
                    <li key={child.id}>
                      <CategoryRow category={child} onEdit={onEdit} onArchive={onArchive} small />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CategoryRow({
  category,
  onEdit,
  onArchive,
  onCreateChild,
  small = false,
}: {
  category: Category;
  onEdit: (category: Category) => void;
  onArchive: (category: Category) => void;
  onCreateChild?: (() => void) | undefined;
  small?: boolean;
}) {
  const archived = category.archivedAt !== null;
  return (
    <div className={`flex items-center gap-3 ${archived ? 'opacity-60' : ''}`}>
      <CategoryIcon
        icon={category.icon}
        color={category.color}
        className={small ? 'size-7' : undefined}
      />
      <span className={`flex-1 truncate ${small ? 'text-sm' : 'font-medium'}`}>
        {category.name}
      </span>
      {category.isSystem ? <Badge variant="secondary">{t.system}</Badge> : null}
      {archived ? <Badge variant="outline">{t.archived}</Badge> : null}
      {archived ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${commonStrings.actions}: ${category.name}`}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(category)}>
              {commonStrings.edit}
            </DropdownMenuItem>
            {onCreateChild ? (
              <DropdownMenuItem onClick={onCreateChild}>{t.newSubcategory}</DropdownMenuItem>
            ) : null}
            {category.isSystem ? null : (
              <DropdownMenuItem variant="destructive" onClick={() => onArchive(category)}>
                {commonStrings.archive}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
