import { createTransferSchema } from '@bolsillo/core/schemas';
import { Hono } from 'hono';
import { validate } from '../../middleware/validate';
import type { AppEnv } from '../../types';
import type { TransfersService } from './service';

export function transfersRoutes(transfers: TransfersService) {
  return new Hono<AppEnv>().post('/', validate('json', createTransferSchema), async (c) => {
    const { transfer, created } = await transfers.create(c.var.userId, c.req.valid('json'));
    return created ? c.json(transfer, 201) : c.json(transfer, 200);
  });
}
