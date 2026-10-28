interface PgError {
  code?: string;
  constraint?: string;
}

/** Drizzle wraps driver errors; the Postgres error is the `cause`. */
function pgErrorOf(error: unknown): PgError | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const cause = (error as { cause?: unknown }).cause;
  const candidate = (typeof cause === 'object' && cause !== null ? cause : error) as PgError;
  return typeof candidate.code === 'string' ? candidate : undefined;
}

/** `true` for a unique violation, optionally on a specific constraint or index. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pg = pgErrorOf(error);
  return pg?.code === '23505' && (constraint === undefined || pg.constraint === constraint);
}
