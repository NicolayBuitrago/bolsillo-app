import type { Category, CategoryKind, CategoryTreeNode } from '../schemas/categories';

export interface CategoryOption extends Category {
  /** Name of the parent for subcategories, e.g. "Alimentación" for "Mercado". */
  parentName: string | null;
  /** "Alimentación › Mercado" for subcategories, the name otherwise. */
  label: string;
}

/** Flattens the tree for pickers: each parent followed by its subcategories. */
export function flattenCategoryTree(
  tree: readonly CategoryTreeNode[],
  kind?: CategoryKind,
): CategoryOption[] {
  const options: CategoryOption[] = [];
  for (const { children, ...parent } of tree) {
    if (kind && parent.kind !== kind) continue;
    options.push({ ...parent, parentName: null, label: parent.name });
    for (const child of children) {
      options.push({ ...child, parentName: parent.name, label: `${parent.name} › ${child.name}` });
    }
  }
  return options;
}
