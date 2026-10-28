import {
  adjustBalanceSchema,
  createAccountSchema,
  idParamSchema,
  listAccountsQuerySchema,
  updateAccountSchema,
} from '@bolsillo/core/schemas';
import { Hono } from 'hono';
import { validate } from '../../middleware/validate';
import type { AppEnv } from '../../types';
import type { AccountsService } from './service';

export function accountsRoutes(accounts: AccountsService) {
  return new Hono<AppEnv>()
    .get('/', validate('query', listAccountsQuerySchema), async (c) => {
      const { includeArchived } = c.req.valid('query');
      return c.json(await accounts.list(c.var.userId, includeArchived ?? false), 200);
    })
    .post('/', validate('json', createAccountSchema), async (c) =>
      c.json(await accounts.create(c.var.userId, c.req.valid('json')), 201),
    )
    .patch(
      '/:id',
      validate('param', idParamSchema),
      validate('json', updateAccountSchema),
      async (c) =>
        c.json(
          await accounts.update(c.var.userId, c.req.valid('param').id, c.req.valid('json')),
          200,
        ),
    )
    .post('/:id/archive', validate('param', idParamSchema), async (c) =>
      c.json(await accounts.archive(c.var.userId, c.req.valid('param').id), 200),
    )
    .post(
      '/:id/adjust-balance',
      validate('param', idParamSchema),
      validate('json', adjustBalanceSchema),
      async (c) =>
        c.json(
          await accounts.adjustBalance(c.var.userId, c.req.valid('param').id, c.req.valid('json')),
          200,
        ),
    );
}
