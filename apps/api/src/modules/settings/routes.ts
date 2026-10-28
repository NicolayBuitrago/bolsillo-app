import { updateSettingsSchema } from '@bolsillo/core/schemas';
import { Hono } from 'hono';
import { validate } from '../../middleware/validate';
import type { AppEnv } from '../../types';
import type { SettingsService } from './service';

export function settingsRoutes(settings: SettingsService) {
  return new Hono<AppEnv>()
    .get('/', async (c) => c.json(await settings.get(c.var.userId), 200))
    .patch('/', validate('json', updateSettingsSchema), async (c) =>
      c.json(await settings.update(c.var.userId, c.req.valid('json')), 200),
    );
}
