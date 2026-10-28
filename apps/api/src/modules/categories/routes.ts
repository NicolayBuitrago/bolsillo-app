import {
  createCategorySchema,
  idParamSchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from '@bolsillo/core/schemas';
import { Hono } from 'hono';
import { validate } from '../../middleware/validate';
import type { AppEnv } from '../../types';
import type { CategoriesService } from './service';

export function categoriesRoutes(categories: CategoriesService) {
  return new Hono<AppEnv>()
    .get('/', validate('query', listCategoriesQuerySchema), async (c) => {
      const { includeArchived } = c.req.valid('query');
      return c.json(await categories.list(c.var.userId, includeArchived ?? false), 200);
    })
    .post('/', validate('json', createCategorySchema), async (c) =>
      c.json(await categories.create(c.var.userId, c.req.valid('json')), 201),
    )
    .patch(
      '/:id',
      validate('param', idParamSchema),
      validate('json', updateCategorySchema),
      async (c) =>
        c.json(
          await categories.update(c.var.userId, c.req.valid('param').id, c.req.valid('json')),
          200,
        ),
    )
    .post('/:id/archive', validate('param', idParamSchema), async (c) =>
      c.json(await categories.archive(c.var.userId, c.req.valid('param').id), 200),
    );
}
