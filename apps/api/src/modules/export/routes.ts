import { exportQuerySchema } from '@bolsillo/core/schemas';
import { Hono } from 'hono';
import { validate } from '../../middleware/validate';
import type { AppEnv } from '../../types';
import type { ExportService } from './service';

export function exportRoutes(exporter: ExportService) {
  return new Hono<AppEnv>().get(
    '/transactions.csv',
    validate('query', exportQuerySchema),
    async (c) => {
      const { filename, body } = await exporter.transactionsCsv(c.var.userId, c.req.valid('query'));
      return c.body(body, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      });
    },
  );
}
