import { z } from 'zod';
import { colorSchema, iconKeySchema } from '../categories/icons';
import { isoDateTimeSchema, queryBooleanSchema, requiredText } from './common';

export const categoryKindSchema = z.enum(['expense', 'income']);
export type CategoryKind = z.infer<typeof categoryKindSchema>;

export const categorySchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  name: z.string(),
  kind: categoryKindSchema,
  isSystem: z.boolean(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  archivedAt: isoDateTimeSchema.nullable(),
});

export type Category = z.infer<typeof categorySchema>;

/** Top-level category with its subcategories (one nesting level). */
export const categoryTreeNodeSchema = categorySchema.extend({
  children: z.array(categorySchema),
});

export type CategoryTreeNode = z.infer<typeof categoryTreeNodeSchema>;

export const createCategorySchema = z.object({
  name: requiredText(40),
  kind: categoryKindSchema,
  parentId: z.uuid().nullable().optional(),
  color: colorSchema.nullable().optional(),
  icon: iconKeySchema.nullable().optional(),
});

export type CreateCategoryInput = z.input<typeof createCategorySchema>;

/** `kind` cannot change: existing transactions depend on it. */
export const updateCategorySchema = createCategorySchema.omit({ kind: true }).partial();

export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;

export const listCategoriesQuerySchema = z.object({ includeArchived: queryBooleanSchema });
