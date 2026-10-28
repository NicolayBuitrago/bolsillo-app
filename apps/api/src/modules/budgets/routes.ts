import {
  budgetSummaryQuerySchema,
  createBudgetSchema,
  idParamSchema,
  listBudgetsQuerySchema,
  updateBudgetSchema,
} from '@bolsillo/core/schemas';
import { Hono } from 'hono';
import { validate } from '../../middleware/validate';
import type { AppEnv } from '../../types';
import type { BudgetsService } from './service';

export function budgetsRoutes(budgets: BudgetsService) {
  return new Hono<AppEnv>()
    .get('/', validate('query', listBudgetsQuerySchema), async (c) => {
      const { includeArchived } = c.req.valid('query');
      return c.json(await budgets.list(c.var.userId, includeArchived ?? false), 200);
    })
    .get('/summary', validate('query', budgetSummaryQuerySchema), async (c) =>
      c.json(await budgets.summary(c.var.userId, c.req.valid('query').month), 200),
    )
    .post('/', validate('json', createBudgetSchema), async (c) =>
      c.json(await budgets.create(c.var.userId, c.req.valid('json')), 201),
    )
    .patch(
      '/:id',
      validate('param', idParamSchema),
      validate('json', updateBudgetSchema),
      async (c) =>
        c.json(
          await budgets.update(c.var.userId, c.req.valid('param').id, c.req.valid('json')),
          200,
        ),
    )
    .post('/:id/archive', validate('param', idParamSchema), async (c) =>
      c.json(await budgets.archive(c.var.userId, c.req.valid('param').id), 200),
    );
}
