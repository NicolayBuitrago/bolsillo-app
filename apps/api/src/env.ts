import { z } from 'zod';

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

/**
 * Environment of the API (docs/06-convenciones.md). Required variables have no
 * default: the process refuses to start without them. Variables for later phases
 * are optional until their phase makes them required.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  WEB_ORIGIN: z.url({ protocol: /^https?$/ }),
  BETTER_AUTH_SECRET: z.string().min(32, 'Must be at least 32 characters'),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Phase 3 (captures).
  DEDUP_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),

  // Phase 4 (optional LLM extraction; disabled without an API key).
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: optionalString,
  LLM_DAILY_LIMIT_PER_USER: z.coerce.number().int().nonnegative().default(50),

  // Phase 5 (email capture).
  EMAIL_WEBHOOK_SECRET: optionalString,
  EMAIL_CAPTURE_DOMAIN: optionalString,
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  override readonly name = 'EnvValidationError';
}

/** Parses the environment. The error message lists variable names, never their values. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new EnvValidationError(`Invalid environment variables:\n${problems.join('\n')}`);
  }
  return result.data;
}
