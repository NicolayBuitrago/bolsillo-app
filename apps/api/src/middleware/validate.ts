import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors';

/**
 * `zValidator` that reports failures with the API error shape
 * (`VALIDATION_ERROR` + issues) instead of the raw Zod error.
 */
export function validate<Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new ValidationError('Datos inválidos', {
        issues: result.error.issues.map(({ path, message, code }) => ({ path, message, code })),
      });
    }
  });
}
