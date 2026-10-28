import { z } from 'zod';

export const idSchema = z.uuid();

/** ISO 8601 instant. Accepts any offset; the API always answers in UTC (`Z`). */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Calendar date `YYYY-MM-DD`, interpreted in the user's time zone. */
export const dateOnlySchema = z.iso.date();

/** Required, trimmed, single-line text. */
export function requiredText(max: number) {
  return z.string().trim().min(1).max(max);
}

/** Optional text where an empty string means "no value" (stored as null). */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();
}

/** Query string boolean (`?includeArchived=true`). */
export const queryBooleanSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX = 100;

export const paginationQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(PAGE_LIMIT_MAX))
    .optional(),
  cursor: z.string().min(1).max(200).optional(),
});

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const idParamSchema = z.object({ id: idSchema });
