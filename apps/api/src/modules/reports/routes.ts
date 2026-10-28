import { monthlyReportQuerySchema } from '@bolsillo/core/schemas';
import { Hono } from 'hono';
import { validate } from '../../middleware/validate';
import type { AppEnv } from '../../types';
import type { ReportsService } from './service';

export function reportsRoutes(reports: ReportsService) {
  return new Hono<AppEnv>().get(
    '/monthly',
    validate('query', monthlyReportQuerySchema),
    async (c) => c.json(await reports.monthly(c.var.userId, c.req.valid('query').month), 200),
  );
}
