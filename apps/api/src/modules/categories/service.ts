import type {
  Category,
  CategoryKind,
  CategoryTreeNode,
  createCategorySchema,
  updateCategorySchema,
} from '@bolsillo/core/schemas';
import { type Database, ensureUserDefaults } from '@bolsillo/db';
import type { z } from 'zod';
import { BusinessRuleError, NotFoundError } from '../../errors';
import {
  archiveCategoryTree,
  type CategoryRow,
  findAdjustmentCategory,
  findCategory,
  hasActiveChildren,
  insertCategory,
  listCategories,
  updateCategory,
} from './repository';

type CreateCategory = z.infer<typeof createCategorySchema>;
type UpdateCategory = z.infer<typeof updateCategorySchema>;

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    kind: row.kind,
    isSystem: row.isSystem,
    color: row.color,
    icon: row.icon,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

/** Kind first (expenses, then income), system categories last, then by name in Spanish. */
function compareCategories(a: CategoryRow, b: CategoryRow): number {
  if (a.kind !== b.kind) return a.kind === 'expense' ? -1 : 1;
  if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
  return a.name.localeCompare(b.name, 'es');
}

export function buildCategoryTree(rows: CategoryRow[]): CategoryTreeNode[] {
  const sorted = [...rows].sort(compareCategories);
  const children = new Map<string, Category[]>();
  for (const row of sorted) {
    if (row.parentId) {
      const list = children.get(row.parentId) ?? [];
      list.push(toCategory(row));
      children.set(row.parentId, list);
    }
  }
  return sorted
    .filter((row) => row.parentId === null)
    .map((row) => ({ ...toCategory(row), children: children.get(row.id) ?? [] }));
}

export function createCategoriesService(db: Database) {
  async function requireCategory(userId: string, id: string): Promise<CategoryRow> {
    const row = await findCategory(db, userId, id);
    if (!row) throw new NotFoundError('Categoría no encontrada');
    return row;
  }

  /** A valid parent is an active, top-level category of the same kind. */
  async function assertValidParent(userId: string, parentId: string, kind: CategoryKind) {
    const parent = await findCategory(db, userId, parentId);
    if (!parent) throw new NotFoundError('Categoría padre no encontrada');
    if (parent.archivedAt) throw new BusinessRuleError('La categoría padre está archivada');
    if (parent.parentId !== null) {
      throw new BusinessRuleError('Solo se permite un nivel de subcategorías');
    }
    if (parent.kind !== kind) {
      throw new BusinessRuleError('La subcategoría debe ser del mismo tipo que su categoría padre');
    }
    if (parent.isSystem) {
      throw new BusinessRuleError('Las categorías de sistema no admiten subcategorías');
    }
  }

  return {
    async list(userId: string, includeArchived: boolean): Promise<CategoryTreeNode[]> {
      return buildCategoryTree(await listCategories(db, userId, includeArchived));
    },

    async create(userId: string, input: CreateCategory): Promise<Category> {
      if (input.parentId) await assertValidParent(userId, input.parentId, input.kind);
      const row = await insertCategory(db, userId, input);
      if (!row) throw new Error('Category insert returned no row');
      return toCategory(row);
    },

    async update(userId: string, id: string, input: UpdateCategory): Promise<Category> {
      const current = await requireCategory(userId, id);
      if (current.archivedAt) throw new BusinessRuleError('La categoría está archivada');
      const changesStructure =
        (input.name !== undefined && input.name !== current.name) ||
        (input.parentId !== undefined && input.parentId !== current.parentId);
      if (current.isSystem && changesStructure) {
        throw new BusinessRuleError('Las categorías de sistema no se pueden renombrar ni mover');
      }
      if (input.parentId) {
        if (input.parentId === id) {
          throw new BusinessRuleError('Una categoría no puede ser su propia categoría padre');
        }
        if (await hasActiveChildren(db, userId, id)) {
          throw new BusinessRuleError('Una categoría con subcategorías no puede ser subcategoría');
        }
        await assertValidParent(userId, input.parentId, current.kind);
      }
      const row = await updateCategory(db, userId, id, input);
      if (!row) throw new NotFoundError('Categoría no encontrada');
      return toCategory(row);
    },

    async archive(userId: string, id: string): Promise<Category> {
      const current = await requireCategory(userId, id);
      if (current.isSystem) {
        throw new BusinessRuleError('Las categorías de sistema no se pueden archivar');
      }
      await archiveCategoryTree(db, userId, id);
      return toCategory(await requireCategory(userId, id));
    },

    /** Category used by balance adjustments; repairs the defaults if they are missing. */
    async adjustmentCategory(userId: string, kind: CategoryKind): Promise<CategoryRow> {
      const existing = await findAdjustmentCategory(db, userId, kind);
      if (existing) return existing;
      await ensureUserDefaults(db, userId);
      const created = await findAdjustmentCategory(db, userId, kind);
      if (!created) throw new Error('Adjustment category missing after bootstrap');
      return created;
    },

    /**
     * Checks a category for a transaction of `kind`. Returns `null` when no
     * category was given.
     */
    async assertUsable(
      userId: string,
      categoryId: string | null | undefined,
      kind: CategoryKind,
    ): Promise<CategoryRow | null> {
      if (!categoryId) return null;
      const category = await findCategory(db, userId, categoryId);
      if (!category) throw new NotFoundError('Categoría no encontrada');
      if (category.archivedAt) throw new BusinessRuleError('La categoría está archivada');
      if (category.kind !== kind) {
        throw new BusinessRuleError(
          kind === 'expense'
            ? 'Un gasto debe usar una categoría de gasto'
            : 'Un ingreso debe usar una categoría de ingreso',
        );
      }
      return category;
    },
  };
}

export type CategoriesService = ReturnType<typeof createCategoriesService>;
