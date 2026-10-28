import { z } from 'zod';

const dbEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type DbEnv = z.infer<typeof dbEnvSchema>;

/** Validates database variables; throws with the list of problems if any is missing. */
export function loadDbEnv(source: NodeJS.ProcessEnv = process.env): DbEnv {
  const result = dbEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid database environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
