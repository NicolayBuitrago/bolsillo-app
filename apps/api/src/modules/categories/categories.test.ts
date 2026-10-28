import type { Category, CategoryTreeNode } from '@bolsillo/core/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { categoryId, errorCode } from '../../test/fixtures';
import { createTestContext, json, signUp, type TestUser } from '../../test/helpers';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let user: TestUser;

beforeAll(async () => {
  ctx = await createTestContext();
  user = await signUp(ctx.app);
});

afterAll(async () => {
  await ctx.destroy();
});

async function tree(query = ''): Promise<CategoryTreeNode[]> {
  return json<CategoryTreeNode[]>(await user.get(`/v1/categories${query}`));
}

describe('categories', () => {
  it('returns expense categories first and system categories last', async () => {
    const nodes = await tree();
    expect(nodes[0]?.kind).toBe('expense');
    const expenses = nodes.filter((node) => node.kind === 'expense');
    expect(expenses.at(-1)).toMatchObject({ name: 'Ajuste', isSystem: true });
  });

  it('creates top-level categories and subcategories', async () => {
    const parent = await json<Category>(
      await user.post('/v1/categories', { name: 'Hogar', kind: 'expense', icon: 'home' }),
    );
    const childRes = await user.post('/v1/categories', {
      name: 'Aseo',
      kind: 'expense',
      parentId: parent.id,
    });
    expect(childRes.status).toBe(201);
    const node = (await tree()).find((item) => item.id === parent.id);
    expect(node?.children.map((child) => child.name)).toEqual(['Aseo']);
  });

  it('allows only one nesting level of the same kind', async () => {
    const groceries = await categoryId(user, 'Mercado');
    const nested = await user.post('/v1/categories', {
      name: 'Frutas',
      kind: 'expense',
      parentId: groceries,
    });
    expect(nested.status).toBe(422);

    const salary = await categoryId(user, 'Salario', 'income');
    const mixed = await user.post('/v1/categories', {
      name: 'Bono',
      kind: 'expense',
      parentId: salary,
    });
    expect(mixed.status).toBe(422);

    const food = await categoryId(user, 'Alimentación');
    const transport = await categoryId(user, 'Transporte');
    const parentToChild = await user.patch(`/v1/categories/${food}`, { parentId: transport });
    expect(parentToChild.status).toBe(422);
  });

  it('moves a subcategory to another parent', async () => {
    const taxi = await categoryId(user, 'Taxi/apps');
    const food = await categoryId(user, 'Alimentación');
    const moved = await json<Category>(
      await user.patch(`/v1/categories/${taxi}`, { parentId: food, color: '#ef4444' }),
    );
    expect(moved).toMatchObject({ parentId: food, color: '#ef4444' });
  });

  it('protects system categories', async () => {
    const adjustment = await categoryId(user, 'Ajuste');
    const archive = await user.post(`/v1/categories/${adjustment}/archive`);
    expect(archive.status).toBe(422);
    expect(await errorCode(archive)).toBe('BUSINESS_RULE');
    expect((await user.patch(`/v1/categories/${adjustment}`, { name: 'Otro' })).status).toBe(422);
    expect((await user.patch(`/v1/categories/${adjustment}`, { color: '#22c55e' })).status).toBe(
      200,
    );
  });

  it('archives a category together with its subcategories', async () => {
    const services = await categoryId(user, 'Servicios');
    const archived = await json<Category>(await user.post(`/v1/categories/${services}/archive`));
    expect(archived.archivedAt).not.toBeNull();
    expect((await tree()).map((node) => node.id)).not.toContain(services);

    const all = await tree('?includeArchived=true');
    const node = all.find((item) => item.id === services);
    expect(node?.children.every((child) => child.archivedAt !== null)).toBe(true);
    expect((await user.patch(`/v1/categories/${services}`, { name: 'X' })).status).toBe(422);
  });
});
