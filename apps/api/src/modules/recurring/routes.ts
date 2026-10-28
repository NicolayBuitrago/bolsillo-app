import {
  createRecurringPaymentSchema,
  idParamSchema,
  payRecurringPaymentSchema,
  upcomingQuerySchema,
  updateRecurringPaymentSchema,
} from '@bolsillo/core/schemas';
import { Hono } from 'hono';
import { validate } from '../../middleware/validate';
import type { AppEnv } from '../../types';
import type { RecurringService } from './service';

export function recurringRoutes(recurring: RecurringService) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await recurring.list(c.var.userId), 200))
    .get('/upcoming', validate('query', upcomingQuerySchema), async (c) =>
      c.json(await recurring.upcoming(c.var.userId, c.req.valid('query').days), 200),
    )
    .post('/', validate('json', createRecurringPaymentSchema), async (c) =>
      c.json(await recurring.create(c.var.userId, c.req.valid('json')), 201),
    )
    .patch(
      '/:id',
      validate('param', idParamSchema),
      validate('json', updateRecurringPaymentSchema),
      async (c) =>
        c.json(
          await recurring.update(c.var.userId, c.req.valid('param').id, c.req.valid('json')),
          200,
        ),
    )
    .post(
      '/:id/pay',
      validate('param', idParamSchema),
      validate('json', payRecurringPaymentSchema),
      async (c) =>
        c.json(
          await recurring.pay(c.var.userId, c.req.valid('param').id, c.req.valid('json')),
          200,
        ),
    );
}
