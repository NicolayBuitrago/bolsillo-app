import {
  createTransactionSchema,
  idParamSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
} from '@bolsillo/core/schemas';
import { Hono } from 'hono';
import { validate } from '../../middleware/validate';
import type { AppEnv } from '../../types';
import type { TransactionsService } from './service';

export function transactionsRoutes(transactions: TransactionsService) {
  return new Hono<AppEnv>()
    .get('/', validate('query', listTransactionsQuerySchema), async (c) =>
      c.json(await transactions.list(c.var.userId, c.req.valid('query')), 200),
    )
    .get('/:id', validate('param', idParamSchema), async (c) =>
      c.json(await transactions.get(c.var.userId, c.req.valid('param').id), 200),
    )
    .post('/', validate('json', createTransactionSchema), async (c) => {
      const { transaction, created } = await transactions.create(c.var.userId, c.req.valid('json'));
      // 201 when created, 200 when an idempotent retry returns the existing one.
      return created ? c.json(transaction, 201) : c.json(transaction, 200);
    })
    .patch(
      '/:id',
      validate('param', idParamSchema),
      validate('json', updateTransactionSchema),
      async (c) =>
        c.json(
          await transactions.update(c.var.userId, c.req.valid('param').id, c.req.valid('json')),
          200,
        ),
    )
    .delete('/:id', validate('param', idParamSchema), async (c) => {
      await transactions.remove(c.var.userId, c.req.valid('param').id);
      return c.body(null, 204);
    });
}
