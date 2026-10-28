import { describe, expect, it } from 'vitest';
import type { CategoryTreeNode } from '../schemas/categories';
import { flattenCategoryTree } from './tree';

const base = { isSystem: false, color: null, icon: null, archivedAt: null };
const tree: CategoryTreeNode[] = [
  {
    ...base,
    id: 'food',
    parentId: null,
    name: 'Alimentación',
    kind: 'expense',
    children: [{ ...base, id: 'groceries', parentId: 'food', name: 'Mercado', kind: 'expense' }],
  },
  { ...base, id: 'salary', parentId: null, name: 'Salario', kind: 'income', children: [] },
];

describe('flattenCategoryTree', () => {
  it('lists parents before their subcategories with labels', () => {
    expect(flattenCategoryTree(tree).map((option) => [option.id, option.label])).toEqual([
      ['food', 'Alimentación'],
      ['groceries', 'Alimentación › Mercado'],
      ['salary', 'Salario'],
    ]);
  });

  it('filters by kind', () => {
    expect(flattenCategoryTree(tree, 'income').map((option) => option.id)).toEqual(['salary']);
  });
});
